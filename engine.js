const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createTempAccount, waitForLovableCode } = require('./email');
const fetch = require('node-fetch');
const path = require('path');

puppeteer.use(StealthPlugin());

const runningTasks = {};

// Headers para fingir ser o navegador nas chamadas de API
const API_HEADERS = (token) => ({
    "Authorization": token,
    "Content-Type": "application/json",
    "Origin": "https://lovable.dev",
    "Referer": "https://lovable.dev/"
});

async function runAutomation({ referralLink, loops, taskId }, updateLog) {
    const log = (msg) => {
        const time = new Date().toLocaleTimeString('pt-BR');
        console.log(`[${time}] ${msg}`);
        if(updateLog) updateLog(`[${time}] ${msg}`);
    };

    let successCount = 0;
    log(`🚀 Iniciando V3 (Debug Mode). Meta: ${loops}`);

    for (let i = 1; i <= parseInt(loops); i++) {
        if (!runningTasks[taskId]) {
            log("🛑 Parada solicitada.");
            break;
        }

        log(`\n👤 [CONTA ${i}/${loops}] Criando identidade...`);
        let browser = null;

        try {
            // 1. Email
            const tempMail = await createTempAccount();
            if (!tempMail) throw new Error("Falha ao criar email");
            log(`📧 Email: ${tempMail.address}`);

            // 2. Navegador
            browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,800']
            });
            const page = await browser.newPage();
            
            // Variável para capturar o token
            let sessionToken = null;

            // Intercepta requisições
            await page.setRequestInterception(true);
            page.on('request', req => req.continue());
            page.on('response', async (res) => {
                if ((res.url().includes('/auth/session') || res.url().includes('/user')) && !sessionToken) {
                    const headers = res.request().headers();
                    if (headers['authorization']) sessionToken = headers['authorization'];
                }
            });

            // 3. Acessar Link
            log("🔗 Acessando convite...");
            await page.goto(referralLink, { waitUntil: 'networkidle2', timeout: 60000 });
            
            // FOTO 1: Carregou a página?
            await page.screenshot({ path: 'public/step1_loaded.png' });

            // 4. Inserir Email (Tentativa mais robusta)
            const emailSel = 'input[type="email"]';
            try {
                await page.waitForSelector(emailSel, { timeout: 10000 });
            } catch (e) {
                await page.screenshot({ path: 'public/error_no_input.png' });
                throw new Error("Campo de email não encontrado (Veja error_no_input.png)");
            }

            await page.type(emailSel, tempMail.address, { delay: 50 }); // Digita devagar
            await new Promise(r => setTimeout(r, 500));
            
            // Tenta clicar no botão em vez de apenas Enter
            log("point_right: Clicando em continuar...");
            
            // Procura botões comuns de login
            const clicked = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const target = buttons.find(b => 
                    b.innerText.toLowerCase().includes('continue') || 
                    b.innerText.toLowerCase().includes('sign') ||
                    b.innerText.toLowerCase().includes('login')
                );
                if (target) {
                    target.click();
                    return true;
                }
                return false;
            });

            if (!clicked) {
                await page.keyboard.press('Enter');
            }

            // FOTO 2: Enviou o email?
            await new Promise(r => setTimeout(r, 3000));
            await page.screenshot({ path: 'public/step2_sent.png' });
            log("📸 Foto tirada: /step2_sent.png (Verifique se pediu Captcha)");

            log("📨 Aguardando link de login no email...");
            const magicLink = await waitForLovableCode(tempMail);

            if (!magicLink) {
                // Se falhou, provavelmente é bloqueio de IP ou Domínio de Email
                log("❌ Link não chegou. Verifique a imagem /step2_sent.png no navegador.");
                throw new Error("Link de login não chegou.");
            }
            
            log("🔗 Link recebido! Logando...");

            // 5. Logar
            await page.goto(magicLink, { waitUntil: 'networkidle0' });
            
            // Aguarda token
            for(let k=0; k<15; k++) {
                if(sessionToken) break;
                await new Promise(r => setTimeout(r, 1000));
            }

            if (!sessionToken) {
                log("⚠️ Forçando reload para pegar token...");
                await page.reload({ waitUntil: 'networkidle0' });
                await new Promise(r => setTimeout(r, 3000));
            }

            if(!sessionToken) throw new Error("Token não capturado.");

            log("🔑 Token capturado! Usando API...");
            await browser.close();
            browser = null;

            // 6. Criar Projeto
            const projectRes = await fetch("https://api.lovable.dev/projects", {
                method: "POST",
                headers: API_HEADERS(sessionToken),
                body: JSON.stringify({ message: "Simple landing page", starter_template: null })
            });
            const project = await projectRes.json();
            
            if (!project.id) throw new Error("Falha ao criar projeto.");
            log(`✨ Projeto: ${project.id}`);

            // 7. Esperar "Geração"
            log("⏳ Simulando (15s)...");
            await new Promise(r => setTimeout(r, 15000));

            // 8. Deploy
            const deployRes = await fetch(`https://api.lovable.dev/projects/${project.id}/deployments`, {
                method: "POST",
                headers: API_HEADERS(sessionToken),
                body: "{}"
            });

            if (deployRes.ok) {
                log("✅ SUCESSO! Crédito enviado.");
                successCount++;
            } else {
                log(`❌ Erro no deploy: ${deployRes.status}`);
            }

        } catch (e) {
            log(`❌ Erro: ${e.message}`);
        } finally {
            if (browser) await browser.close();
        }

        if (i < parseInt(loops)) {
            log("💤 Esfriando (15s)...");
            await new Promise(r => setTimeout(r, 15000));
        }
    }
    log(`🏁 FIM. Sucessos: ${successCount}`);
    delete runningTasks[taskId];
}

module.exports = { 
    runAutomation, 
    startTask: (id) => runningTasks[id] = true, 
    stopTask: (id) => delete runningTasks[id] 
};