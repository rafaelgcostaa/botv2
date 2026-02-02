const fetch = require('node-fetch');

// API Pública do 1SecMail (Não precisa de cadastro, é só usar)
const API_BASE = "https://www.1secmail.com/api/v1/";

// Lista de domínios permitidos (Rotaciona para evitar bloqueio)
const DOMAINS = [
    "1secmail.com",
    "1secmail.org",
    "1secmail.net",
    "kzccv.com",
    "qiott.com",
    "wuuvo.com",
    "icxfx.com"
];

function generateRandomString(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Cria um email temporário no 1SecMail
 * Diferente do Mail.tm, aqui não precisa "criar" a conta na API,
 * basta inventar um endereço válido e começar a consultar.
 */
async function createTempAccount() {
    try {
        const login = generateRandomString(10);
        const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
        const address = `${login}@${domain}`;
        
        console.log(`[EMAIL] 📧 Email Gerado (1SecMail): ${address}`);
        
        // Retorna o objeto pronto para uso
        return { 
            address, 
            login, 
            domain 
        };
    } catch (e) {
        console.error("Erro ao gerar email:", e.message);
        return null;
    }
}

/**
 * Aguarda chegar o email da Lovable
 */
async function waitForLovableCode(accountObj) {
    console.log(`[EMAIL] ⏳ Monitorando caixa de entrada: ${accountObj.address}...`);
    
    // Tenta por 60 segundos (30 tentativas de 2s)
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000)); // Espera 2s

        try {
            // Consulta a caixa de entrada
            const url = `${API_BASE}?action=getMessages&login=${accountObj.login}&domain=${accountObj.domain}`;
            const res = await fetch(url);
            const messages = await res.json();

            if (messages && messages.length > 0) {
                // Pegamos o ID do primeiro email
                const msgId = messages[0].id;
                const sender = messages[0].from;
                const subject = messages[0].subject;

                console.log(`[EMAIL] 📬 Email detectado de: ${sender} | Assunto: ${subject}`);

                // Se o email não for da Lovable, ignora e continua esperando
                if (!sender.includes('lovable') && !subject.toLowerCase().includes('lovable')) {
                    continue;
                }
                
                // Lê o conteúdo completo do email
                const readUrl = `${API_BASE}?action=readMessage&login=${accountObj.login}&domain=${accountObj.domain}&id=${msgId}`;
                const msgRes = await fetch(readUrl);
                const fullMsg = await msgRes.json();
                
                // Busca o Link Mágico no corpo (HTML ou Texto)
                // O padrão é https://lovable.dev/verify-email?token=...
                // ou https://lovable.dev/login?token=...
                const bodyText = fullMsg.textBody || fullMsg.body;
                
                const match = bodyText.match(/https:\/\/(?:www\.)?lovable\.dev\/(?:verify-email|login)\?token=[^\s"']+/);
                
                if (match) {
                    console.log("[EMAIL] ✅ Link de login encontrado!");
                    return match[0];
                } else {
                    console.log("[EMAIL] ⚠️ Email recebido, mas não achei o link. Tentando regex alternativo...");
                    // Tentativa secundária de regex mais ampla
                    const matchWide = bodyText.match(/https?:\/\/[^\s]+/g);
                    if (matchWide) {
                         const target = matchWide.find(l => l.includes('token=') && l.includes('lovable'));
                         if (target) return target;
                    }
                }
            }
        } catch (err) {
            // Ignora erros de rede momentâneos (ex: 1secmail instável)
            console.log(`[EMAIL] Erro de conexão temporário... tentando novamente.`);
        }
    }
    
    console.log("[EMAIL] ❌ Timeout: O email não chegou no 1SecMail.");
    return null;
}

module.exports = { createTempAccount, waitForLovableCode };