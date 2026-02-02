const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createTempAccount, waitForLovableCode } = require('./email');

puppeteer.use(StealthPlugin());

const runningTasks = {};
const DEFAULT_PASSWORD = "PasswordStrong2026!";

// Função auxiliar para clicar em "Publish" em uma página específica
async function clickPublishOnPage(page, pageIndex) {
    console.log(`[TAB ${pageIndex}] 🚀 Tentando Publicar...`);
    try {
        // Clicar no botão Publish (Topo)
        const clicked1 = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const target = btns.find(b => b.innerText.includes('Publish') || b.innerText.includes('Deploy'));
            if(target) { target.click(); return true; }
            return false;
        });

        if(!clicked1) return false;
        
        await new Promise(r => setTimeout(r, 1000)); // Espera modal

        // Clicar no botão Confirmar (Dentro do Modal)
        const clicked2 = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            // Procura o botão de confirmação (geralmente o último 'Publish')
            const target = btns.reverse().find(b => b.innerText.includes('Publish'));
            if(target) { target.click(); return true; }
            return false;
        });

        if(clicked2) console.log(`[TAB ${pageIndex}] ✅ PUBLICADO COM SUCESSO!`);
        return clicked2;
    } catch (e) {
        console.log(`[TAB ${pageIndex}] ❌ Falha: ${e.message}`);
        return false;
    }
}

async function runAutomation({ referralLink, loops, taskId }, updateLog) {
    const log = (msg) => {
        const time = new Date().toLocaleTimeString('pt-BR');
        console.log(`[${time}] ${msg}`);
        if(updateLog) updateLog(`[${time}] ${msg}`);
    };

    let successCount = 0;
    log(`🚀 V8: Jaboti Multi-Tab Exploit (5x). Meta: ${loops}`);

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
            const mainPage = await browser.newPage();

            // --- CADASTRO ---
            log("🔗 Acessando...");
            await mainPage.goto(referralLink, { waitUntil: 'networkidle2', timeout: 60000 });

            // Email
            const emailSel = 'input[type="email"]';
            await mainPage.waitForSelector(emailSel);
            await mainPage.type(emailSel, tempMail.address, { delay: 50 });
            await mainPage.keyboard.press('Enter');
            
            // Senha
            log("🔑 Senha...");
            try {
                const passSel = 'input[type="password"]';
                await mainPage.waitForSelector(passSel, { timeout: 10000 });
                await mainPage.type(passSel, DEFAULT_PASSWORD, { delay: 50 });
                await mainPage.keyboard.press('Enter');
                await mainPage.screenshot({ path: 'public/step_senha_enviada.png' });
            } catch(e) {
                log("⚠️ Fluxo sem senha ou erro.");
            }

            // --- ATIVAÇÃO ---
            log("📩 Aguardando email (API TigrMail)...");
            const actLink = await waitForLovableCode(tempMail);
            if (!actLink) throw new Error("Link não chegou.");
            
            log("🔗 Ativando conta...");
            await mainPage.goto(actLink, { waitUntil: 'networkidle0' });
            
            // Verifica se tem onboarding (Nome, Cargo) e pula se necessário
            try {
                // Tenta clicar em qualquer botão "Skip" ou "Continue" que apareça no onboarding
                await mainPage.evaluate(() => {
                    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Skip') || b.innerText.includes('Continue'));
                    if(btn) btn.click();
                });
            } catch(e) {}

            await new Promise(r => setTimeout(r, 5000)); // Carregar painel
            await mainPage.screenshot({ path: 'public/step_painel.png' });

            // --- CRIAÇÃO (JABOTI) ---
            log("🤖 Criando Jaboti Cyberpunk...");
            
            const prompt = "Crie uma pagina com jaboti cyberpunk mode";
            const textArea = 'textarea, [contenteditable="true"]';
            await mainPage.waitForSelector(textArea);
            await mainPage.type(textArea, prompt, { delay: 20 });
            await new Promise(r => setTimeout(r, 500));
            await mainPage.keyboard.press('Enter'); // Aperta enter/seta

            log("⏳ Aguardando geração (30s)...");
            await new Promise(r => setTimeout(r, 30000));
            await mainPage.screenshot({ path: 'public/step_gerado.png' });

            // --- O EXPLOIT (5 ABAS) ---
            log("🔥 INICIANDO EXPLOIT 5x PUBLISH 🔥");
            
            const projectUrl = mainPage.url();
            log(`🔗 URL do Projeto: ${projectUrl}`);
            
            const pages = [mainPage]; // Array com todas as abas

            // Abre mais 4 abas (Total 5)
            for(let k=0; k<4; k++) {
                log(`📑 Abrindo aba clone ${k+1}...`);
                const newTab = await browser.newPage();
                await newTab.goto(projectUrl, { waitUntil: 'domcontentloaded' });
                pages.push(newTab);
            }

            log("⚡ Disparando cliques simultâneos...");
            
            // Executa a função de clicar em todas as abas ao mesmo tempo
            const results = await Promise.all(pages.map((p, idx) => clickPublishOnPage(p, idx)));

            // Conta quantos deram certo
            const publishCount = results.filter(r => r === true).length;
            log(`🏁 Resultado: ${publishCount} de 5 abas publicaram.`);
            
            if (publishCount > 0) successCount++;
            
            await new Promise(r => setTimeout(r, 2000));
            await mainPage.screenshot({ path: 'public/step_final_exploit.png' });

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
    log(`🏁 FIM. Sucessos Totais: ${successCount}`);
    delete runningTasks[taskId];
}

module.exports = { 
    runAutomation, 
    startTask: (id) => runningTasks[id] = true, 
    stopTask: (id) => delete runningTasks[id] 
};
