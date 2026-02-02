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
    log(`🚀 V7: Jaboti Cyberpunk Mode. Meta: ${loops}`);

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

            // --- STEP 1: HOME ---
            await page.goto(referralLink, { waitUntil: 'networkidle2', timeout: 60000 });
            await page.screenshot({ path: 'public/step1_home.png' });
            log("📸 step1_home.png");

            // --- STEP 2: EMAIL ---
            const emailSel = 'input[type="email"]';
            await page.waitForSelector(emailSel);
            await page.type(emailSel, tempMail.address, { delay: 50 });
            await page.keyboard.press('Enter');
            await new Promise(r => setTimeout(r, 2000));
            await page.screenshot({ path: 'public/step2_email.png' });
            log("📸 step2_email.png");

            // --- STEP 3: SENHA ---
            try {
                const passSel = 'input[type="password"]';
                await page.waitForSelector(passSel, { timeout: 10000 });
                await page.type(passSel, DEFAULT_PASSWORD, { delay: 50 });
                await page.keyboard.press('Enter');
                await new Promise(r => setTimeout(r, 3000));
                await page.screenshot({ path: 'public/step3_senha.png' });
                log("📸 step3_senha.png");
            } catch(e) {
                log("⚠️ Pulo da senha (ou erro).");
                await page.screenshot({ path: 'public/debug_pass_error.png' });
            }

            // --- STEP 4: EMAIL WAIT ---
            log("📩 Aguardando email...");
            const actLink = await waitForLovableCode(tempMail);
            if (!actLink) throw new Error("Link não chegou.");
            
            // --- STEP 5: ATIVAÇÃO ---
            log("🔗 Clicando no link...");
            await page.goto(actLink, { waitUntil: 'networkidle0' });
            await new Promise(r => setTimeout(r, 5000)); // Espera carregar painel
            await page.screenshot({ path: 'public/step5_painel_logado.png' });
            log("📸 step5_painel_logado.png");

            // --- STEP 6: JABOTI ESPACIAL (PROMPT) ---
            log("🤖 Digitando prompt...");
            
            // Tenta achar a caixa de texto (pode variar, tentamos selector genérico)
            const promptText = "Quero uma landingpage de um Jaboti espacial cyberpunk";
            const textareaSel = 'textarea, input[placeholder*="Describe"], [contenteditable="true"]';
            
            await page.waitForSelector(textareaSel, { timeout: 15000 });
            await page.type(textareaSel, promptText, { delay: 30 });
            await new Promise(r => setTimeout(r, 1000));
            
            // Clicar em Enviar/Gerar (Busca botão perto do textarea ou botão de submit)
            await page.keyboard.press('Enter');
            log("👉 Prompt enviado. Aguardando geração...");
            
            await page.screenshot({ path: 'public/step6_prompt_enviado.png' });
            log("📸 step6_prompt_enviado.png");

            // --- STEP 7: AGUARDAR GERAÇÃO ---
            // Espera tempo fixo generoso para a IA trabalhar
            log("⏳ Criando Jaboti (Aguardando 25s)...");
            await new Promise(r => setTimeout(r, 25000));
            
            await page.screenshot({ path: 'public/step7_gerado.png' });
            log("📸 step7_gerado.png");

            // --- STEP 8: PUBLICAR (MODAL 1) ---
            log("🚀 Tentando clicar em Publish...");
            
            // Procura botão que contenha texto "Publish" ou "Deploy"
            const clicked1 = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
                const target = buttons.find(b => b.innerText.includes('Publish') || b.innerText.includes('Deploy'));
                if (target) { target.click(); return true; }
                return false;
            });

            if (!clicked1) log("⚠️ Botão Publish 1 não achado.");
            else log("👉 Publish 1 clicado.");

            await new Promise(r => setTimeout(r, 2000));
            await page.screenshot({ path: 'public/step8_modal_aberto.png' });

            // --- STEP 9: PUBLICAR FINAL (MODAL 2) ---
            log("🚀 Confirmando Publish...");
            
            // Clica no botão de confirmação dentro do modal
            const clicked2 = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                // Geralmente é o botão com cor de destaque ou "Publish" novamente
                const target = buttons.find(b => b.innerText.includes('Publish') && b.offsetParent !== null); 
                if (target) { target.click(); return true; }
                return false;
            });

            if(clicked2) {
                log("✅ SUCESSO! Projeto Publicado.");
                successCount++;
                await new Promise(r => setTimeout(r, 3000));
                await page.screenshot({ path: 'public/step9_final_sucesso.png' });
            } else {
                log("⚠️ Botão Confirmar Publish não achado.");
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