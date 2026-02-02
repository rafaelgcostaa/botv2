const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createTempAccount, waitForLovableCode } = require('./email');
const fetch = require('node-fetch');

puppeteer.use(StealthPlugin());

const runningTasks = {};

// Headers para fingir ser o navegador
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
    log(`🚀 Iniciando Bot V2 (Referral). Meta: ${loops}`);

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
            
            // Variável para capturar o token de sessão
            let sessionToken = null;

            // Intercepta requisições para roubar o token
            await page.setRequestInterception(true);
            page.on('request', req => req.continue());
            page.on('response', async (res) => {
                if ((res.url().includes('/auth/session') || res.url().includes('/user')) && !sessionToken) {
                    const headers = res.request().headers();
                    if (headers['authorization']) sessionToken = headers['authorization'];
                }
            });

            // 3. Acessar Link de Convite
            log("🔗 Acessando convite...");
            await page.goto(referralLink, { waitUntil: 'networkidle2', timeout: 60000 });

            // 4. Inserir Email
            const emailSel = 'input[type="email"]';
            await page.waitForSelector(emailSel, { timeout: 15000 });
            await page.type(emailSel, tempMail.address);
            await page.keyboard.press('Enter');

            log("📨 Aguardando link de login no email...");
            const magicLink = await waitForLovableCode(tempMail);

            if (!magicLink) throw new Error("Link de login não chegou.");
            log("🔗 Link recebido! Logando...");

            // 5. Logar
            await page.goto(magicLink, { waitUntil: 'networkidle0' });
            
            // Aguarda token ser capturado
            for(let k=0; k<15; k++) {
                if(sessionToken) break;
                await new Promise(r => setTimeout(r, 1000));
            }

            if (!sessionToken) {
                log("⚠️ Tentando forçar reload para pegar token...");
                await page.reload({ waitUntil: 'networkidle0' });
                if(!sessionToken) throw new Error("Token não capturado.");
            }

            log("🔑 Token capturado! Usando API direta...");
            
            // Fecha navegador para economizar memória e vai de API
            await browser.close();
            browser = null;

            // 6. Criar Projeto
            const projectRes = await fetch("https://api.lovable.dev/projects", {
                method: "POST",
                headers: API_HEADERS(sessionToken),
                body: JSON.stringify({ message: "Create a simple hello world page", starter_template: null })
            });
            const project = await projectRes.json();
            
            if (!project.id) throw new Error("Falha ao criar projeto.");
            log(`✨ Projeto criado: ${project.id}`);

            // 7. Esperar "Geração" (Delay humano)
            log("⏳ Aguardando 15s (Simulação)...");
            await new Promise(r => setTimeout(r, 15000));

            // 8. Deploy (Gatilho do Bônus)
            const deployRes = await fetch(`https://api.lovable.dev/projects/${project.id}/deployments`, {
                method: "POST",
                headers: API_HEADERS(sessionToken),
                body: "{}"
            });

            if (deployRes.ok) {
                log("✅ DEPLOY SUCESSO! Bônus enviado para conta principal.");
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