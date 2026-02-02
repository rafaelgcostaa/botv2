const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createTempAccount, waitForLovableCode } = require('./email');
const fetch = require('node-fetch');

puppeteer.use(StealthPlugin());

const runningTasks = {};

// Headers de Navegador Real
const API_HEADERS = (token) => ({
    "Authorization": token,
    "Content-Type": "application/json",
    "Origin": "https://lovable.dev",
    "Referer": "https://lovable.dev/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
});

// Função para simular clique humano
async function humanClick(page, selector) {
    try {
        const element = await page.waitForSelector(selector, { timeout: 5000 });
        if (element) {
            const box = await element.boundingBox();
            const x = box.x + (box.width / 2);
            const y = box.y + (box.height / 2);
            await page.mouse.move(x, y);
            await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
            await page.mouse.down();
            await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
            await page.mouse.up();
            return true;
        }
    } catch (e) { return false; }
    return false;
}

async function runAutomation({ referralLink, loops, taskId }, updateLog) {
    const log = (msg) => {
        const time = new Date().toLocaleTimeString('pt-BR');
        console.log(`[${time}] ${msg}`);
        if(updateLog) updateLog(`[${time}] ${msg}`);
    };

    let successCount = 0;
    log(`🚀 Iniciando V4 (Human Mode). Meta: ${loops}`);

    for (let i = 1; i <= parseInt(loops); i++) {
        if (!runningTasks[taskId]) { log("🛑 Parada."); break; }

        log(`\n👤 [CONTA ${i}/${loops}] Criando identidade...`);
        let browser = null;

        try {
            // 1. Email
            const tempMail = await createTempAccount();
            if (!tempMail) throw new Error("Erro no email");
            log(`📧 Email: ${tempMail.address}`);

            // 2. Navegador (Configuração Anti-Detecção Reforçada)
            browser = await puppeteer.launch({
                headless: "new",
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--window-size=1366,768',
                    `--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`
                ]
            });
            const page = await browser.newPage();
            
            // Mascara webdriver
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
            });

            // Captura Token
            let sessionToken = null;
            await page.setRequestInterception(true);
            page.on('request', req => req.continue());
            page.on('response', async (res) => {
                if ((res.url().includes('/auth/session') || res.url().includes('/user')) && !sessionToken) {
                    const headers = res.request().headers();
                    if (headers['authorization']) sessionToken = headers['authorization'];
                }
            });

            // 3. Acessar
            log("🔗 Acessando...");
            await page.goto(referralLink, { waitUntil: 'networkidle2', timeout: 60000 });
            
            // 4. Preencher Email (Digitação Humana)
            const emailSel = 'input[type="email"]';
            try { await page.waitForSelector(emailSel, { timeout: 10000 }); } 
            catch (e) { 
                await page.screenshot({ path: 'public/error_input.png' });
                throw new Error("Input não achado (Veja error_input.png)");
            }

            await page.click(emailSel);
            await page.type(emailSel, tempMail.address, { delay: 100 }); // Lento
            await new Promise(r => setTimeout(r, 800));

            // Tenta clicar no botão "Continue" ou "Sign up"
            log("👉 Clicando (Humano)...");
            
            // Tenta achar o botão pelo texto ou type submit
            let clicked = await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const target = btns.find(b => b.innerText.includes('Continue') || b.innerText.includes('Sign') || b.type === 'submit');
                if(target) { target.click(); return true; }
                return false;
            });
            
            if(!clicked) await page.keyboard.press('Enter');

            // Screenshot do momento pós-clique
            await new Promise(r => setTimeout(r, 5000));
            await page.screenshot({ path: 'public/step2_sent.png' });
            log("📸 Verificando envio...");

            // Se aparecer "Verify you are human" no título ou corpo, aborta
            const pageContent = await page.content();
            if (pageContent.includes('challenge') || pageContent.includes('human')) {
                throw new Error("⚠️ BLOQUEIO CLOUDFLARE DETECTADO! IP do servidor bloqueado.");
            }

            log("📨 Aguardando link...");
            const magicLink = await waitForLovableCode(tempMail);

            if (!magicLink) throw new Error("Link não chegou (Provável bloqueio de IP).");
            
            log("🔗 Logando...");
            await page.goto(magicLink, { waitUntil: 'networkidle0' });

            // Aguarda Token
            for(let k=0; k<15; k++) {
                if(sessionToken) break;
                await new Promise(r => setTimeout(r, 1000));
            }

            if(!sessionToken) {
                 await page.reload({ waitUntil: 'networkidle0' });
                 await new Promise(r => setTimeout(r, 3000));
            }
            if(!sessionToken) throw new Error("Token não capturado.");

            log("🔑 Token OK! Criando projeto...");
            await browser.close();
            browser = null;

            // API: Criar
            const projectRes = await fetch("https://api.lovable.dev/projects", {
                method: "POST", headers: API_HEADERS(sessionToken),
                body: JSON.stringify({ message: "Hello world app", starter_template: null })
            });
            const project = await projectRes.json();
            
            if (!project.id) throw new Error("Erro criação projeto.");
            
            log("⏳ Simulando criação (15s)...");
            await new Promise(r => setTimeout(r, 15000));

            // API: Deploy
            const deployRes = await fetch(`https://api.lovable.dev/projects/${project.id}/deployments`, {
                method: "POST", headers: API_HEADERS(sessionToken), body: "{}"
            });

            if (deployRes.ok) {
                log("✅ SUCESSO! Bônus +10.");
                successCount++;
            } else {
                log(`❌ Deploy falhou: ${deployRes.status}`);
            }

        } catch (e) {
            log(`❌ ${e.message}`);
        } finally {
            if (browser) await browser.close();
        }

        if (i < parseInt(loops)) await new Promise(r => setTimeout(r, 15000));
    }
    log(`🏁 FIM. Sucessos: ${successCount}`);
    delete runningTasks[taskId];
}

module.exports = { runAutomation, startTask: (id) => runningTasks[id] = true, stopTask: (id) => delete runningTasks[id] };