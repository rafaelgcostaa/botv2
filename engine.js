const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createTempAccount, waitForLovableCode } = require('./email');
const fetch = require('node-fetch');

puppeteer.use(StealthPlugin());

const runningTasks = {};
const DEFAULT_PASSWORD = "PasswordStrong2026!"; // Senha fixa para criar a conta

// Headers para a API (usados na fase final)
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
    log(`🚀 Iniciando V6 (Fluxo: Senha + Ativação + Prints). Meta: ${loops}`);

    for (let i = 1; i <= parseInt(loops); i++) {
        if (!runningTasks[taskId]) { log("🛑 Parada."); break; }

        log(`\n👤 [CONTA ${i}/${loops}] Criando identidade...`);
        let browser = null;

        try {
            // 1. Email (TigrMail)
            const tempMail = await createTempAccount();
            if (!tempMail) throw new Error("Erro ao criar email.");
            log(`📧 Email: ${tempMail.address}`);

            // 2. Navegador
            browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--window-size=1366,768']
            });
            const page = await browser.newPage();
            
            // Variável para o Token
            let sessionToken = null;

            // Interceptador de Token
            await page.setRequestInterception(true);
            page.on('request', req => req.continue());
            page.on('response', async (res) => {
                if ((res.url().includes('/auth/session') || res.url().includes('/user')) && !sessionToken) {
                    const headers = res.request().headers();
                    if (headers['authorization']) sessionToken = headers['authorization'];
                }
            });

            // --- PASSO 1: Acessar Home ---
            log("🔗 Acessando convite...");
            await page.goto(referralLink, { waitUntil: 'networkidle2', timeout: 60000 });
            await page.screenshot({ path: 'public/step1_home.png' });
            log("📸 Foto: step1_home.png");

            // --- PASSO 2: Digitar Email ---
            const emailSel = 'input[type="email"]';
            await page.waitForSelector(emailSel, { timeout: 15000 });
            await page.type(emailSel, tempMail.address, { delay: 80 });
            await new Promise(r => setTimeout(r, 500));
            
            log("👉 Enviando email...");
            await page.keyboard.press('Enter');
            
            await new Promise(r => setTimeout(r, 2000)); // Espera transição
            await page.screenshot({ path: 'public/step2_email_sent.png' });
            log("📸 Foto: step2_email_sent.png");

            // --- PASSO 3: Digitar Senha ---
            log("🔑 Aguardando campo de senha...");
            const passwordSel = 'input[type="password"]';
            try {
                await page.waitForSelector(passwordSel, { timeout: 10000 });
                await page.type(passwordSel, DEFAULT_PASSWORD, { delay: 80 });
                await new Promise(r => setTimeout(r, 500));
                
                log("👉 Enviando senha...");
                await page.keyboard.press('Enter');

                await new Promise(r => setTimeout(r, 3000)); // Espera envio
                await page.screenshot({ path: 'public/step3_password_sent.png' });
                log("📸 Foto: step3_password_sent.png");

            } catch (e) {
                log("⚠️ Campo de senha não apareceu ou erro no envio.");
                await page.screenshot({ path: 'public/error_password.png' });
                throw new Error("Falha no passo da senha (ver error_password.png)");
            }

            // --- PASSO 4: Aguardar Email ---
            log("📩 Aguardando email de ativação (TigrMail)...");
            
            // Tira foto da tela de espera (para ver se pediu captcha)
            await page.screenshot({ path: 'public/step4_waiting_email.png' });

            const activationLink = await waitForLovableCode(tempMail);
            if (!activationLink) throw new Error("Link de ativação não chegou.");
            
            log("🔗 Link recebido! Ativando...");

            // --- PASSO 5: Clicar no Link ---
            await page.goto(activationLink, { waitUntil: 'networkidle0' });
            await page.screenshot({ path: 'public/step5_activation_clicked.png' });
            log("📸 Foto: step5_activation_clicked.png");

            // --- PASSO 6: Verificar Login ---
            log("🔄 Verificando sessão...");
            for(let k=0; k<15; k++) {
                if(sessionToken) break;
                await new Promise(r => setTimeout(r, 1000));
            }

            if (!sessionToken) {
                // Tenta reload se não pegou token
                await page.reload({ waitUntil: 'networkidle0' });
                await new Promise(r => setTimeout(r, 2000));
            }

            if(!sessionToken) {
                await page.screenshot({ path: 'public/error_no_token.png' });
                throw new Error("Token não capturado. Login falhou?");
            }

            log("✅ Token Capturado! Conta logada.");
            await browser.close();
            browser = null;

            // --- PASSO 7: Automação API ---
            log("✨ Criando projeto...");
            const projectRes = await fetch("https://api.lovable.dev/projects", {
                method: "POST", headers: API_HEADERS(sessionToken),
                body: JSON.stringify({ message: "Landing page startup", starter_template: null })
            });
            const project = await projectRes.json();
            
            if (!project.id) throw new Error("Erro criação projeto API.");

            log("⏳ Simulando (15s)...");
            await new Promise(r => setTimeout(r, 15000));

            log("🚀 Deploy...");
            const deployRes = await fetch(`https://api.lovable.dev/projects/${project.id}/deployments`, {
                method: "POST", headers: API_HEADERS(sessionToken), body: "{}"
            });

            if (deployRes.ok) {
                log("✅ SUCESSO! Bônus Enviado.");
                successCount++;
            } else {
                log(`❌ Falha Deploy: ${deployRes.status}`);
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