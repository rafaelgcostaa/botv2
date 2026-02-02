const fetch = require('node-fetch');

// Token da TigrMail
const API_TOKEN = "9qy8seulp5eel7qxq6sclu379pwfw5hkr5f0mbknvm83oikf2oa7tnsmf705zara";
const API_BASE = "https://api.tigrmail.com";

async function createTempAccount() {
    try {
        const res = await fetch(`${API_BASE}/v1/inboxes`, {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${API_TOKEN}`,
                "Content-Type": "application/json" 
            }
        });
        const data = await res.json();
        console.log(`[EMAIL] 📧 Email Criado: ${data.inbox}`);
        return { address: data.inbox };
    } catch (e) {
        console.error("Erro ao gerar email:", e.message);
        return null;
    }
}

async function waitForLovableCode(accountObj) {
    console.log(`[EMAIL] ⏳ Monitorando caixa: ${accountObj.address}`);

    // Loop de 40 tentativas (aprox 3 minutos)
    for (let attempt = 1; attempt <= 40; attempt++) {
        try {
            const url = `${API_BASE}/v1/messages?inbox=${encodeURIComponent(accountObj.address)}`;
            
            // Timeout curto (10s) para não travar o servidor
            const res = await fetch(url, {
                method: "GET",
                headers: { "Authorization": `Bearer ${API_TOKEN}` },
                timeout: 10000 
            });

            if (res.ok) {
                const data = await res.json();
                if (data.message) {
                    console.log(`[EMAIL] 📬 Chegou! Assunto: "${data.message.subject}"`);
                    const body = data.message.body;
                    
                    // Procura link de login ou verify
                    const match = body.match(/https:\/\/(?:www\.)?lovable\.dev\/(?:verify-email|login)\?token=[^\s"']+/);
                    if (match) return match[0];

                    // Fallback
                    const matchWide = body.match(/https?:\/\/[^\s]+/g);
                    if (matchWide) {
                         const target = matchWide.find(l => l.includes('token='));
                         if (target) return target;
                    }
                }
            }
        } catch (err) { process.stdout.write("."); }
        
        // Espera 5s entre tentativas
        await new Promise(r => setTimeout(r, 5000));
    }
    return null;
}

module.exports = { createTempAccount, waitForLovableCode };
