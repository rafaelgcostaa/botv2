const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createTempAccount, waitForLovableCode } = require('./email');

puppeteer.use(StealthPlugin());

const runningTasks = {};
const DEFAULT_PASSWORD = "PasswordStrong2026!";

async function runAutomation({ referralLink, loops, taskId }, updateLog) {
    const log = (msg) => {
        const time = new Date().toLocaleTimeString('pt-BR');
        console.log(`[${time}] ${msg}`);
        if(updateLog) updateLog(`[${time}] ${msg}`);
    };

    let successCount = 0;
    log(`🚀 V9: Debug Email Mode. Meta: ${loops}`);

    for (let i = 1; i <= parseInt(loops); i++) {
        if (!runningTasks[taskId]) { log("🛑 Parada."); break; }

        log(`\n👤 [CONTA ${i}/${loops}] Iniciando...`);
        let browser = null;

        try {
            // 1. Email
            const tempMail = await createTempAccount();
            if (!tempMail) throw new Error("Erro email");
            log(`📧 ${tempMail.address}`);

            // 2. Browser
            browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,768']
            });
            const page = await browser.newPage();

            // --- PASSO 1: HOME ---
            log("🔗 Acessando...");
            await page.goto(referralLink, { waitUntil: 'networkidle2', timeout: 60000 });
            await page.screenshot({ path: 'public/step1_home.png' });

            // --- PASSO 2: EMAIL ---
            const emailSel = 'input[type="email"]';
            await page.waitForSelector(emailSel);
            await page.type(emailSel, tempMail.address, { delay: 50 });
            await page.keyboard.press('Enter');
            
            // --- PASSO 3: SENHA ---
            log("🔑 Inserindo senha...");
            try {
                const passSel = 'input[type="password"]';
                await page.waitForSelector(passSel, { timeout: 15000 }); // Espera mais tempo
                await page.type(passSel, DEFAULT_PASSWORD, { delay: 50 });
                await page.keyboard.press('Enter');
                
                // Espera a tela mudar para "Check your email"
                await new Promise(r => setTimeout(r, 5000));
                await page.screenshot({ path: 'public/step_check_email.png' });
            } catch(e) {
                log("⚠️ Campo de senha não apareceu? Verifique print.");
                await page.screenshot({ path: 'public/error_pass.png' });
            }

            // --- PASSO 4: LER EMAIL ---
            log("📩 Consultando API do TigrMail...");
            const actLink = await waitForLovableCode(tempMail); // Chama o novo email.js
            
            if (!actLink) {
                throw new Error("Link não encontrado no email (verifique logs).");
            }
            
            log("🔗 Link recebido! Ativando...");
            await page.goto(actLink, { waitUntil: 'networkidle0' });
            
            // --- PASSO 5: LOGADO! ---
            log("✅ Conta ativada com sucesso!");
            await page.screenshot({ path: 'public/step_logado.png' });

            // (Aqui continuaria o código do Jaboti/Publish...)
            // Vou encerrar aqui para você testar se O EMAIL FUNCIONA primeiro.
            successCount++;

        } catch (e) {
            log(`❌ Erro: ${e.message}`);
        } finally {
            if (browser) await browser.close();
        }

        if (i < parseInt(loops)) await new Promise(r => setTimeout(r, 10000));
    }
    log(`🏁 FIM.`);
    delete runningTasks[taskId];
}

module.exports = { 
    runAutomation, 
    startTask: (id) => runningTasks[id] = true, 
    stopTask: (id) => delete runningTasks[id] 
};
