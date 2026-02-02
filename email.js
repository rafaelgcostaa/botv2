const fetch = require('node-fetch');

const API_BASE = "https://api.mail.tm";

async function createTempAccount() {
    try {
        // 1. Pega um domínio
        const domainRes = await fetch(`${API_BASE}/domains`);
        const domains = await domainRes.json();
        if (!domains['hydra:member'] || !domains['hydra:member'][0]) return null;
        
        const domain = domains['hydra:member'][0].domain;
        const randomName = Math.random().toString(36).substring(7);
        const address = `${randomName}@${domain}`;
        const password = "BotPassword123!";

        // 2. Cria a conta
        await fetch(`${API_BASE}/accounts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address, password })
        });

        // 3. Pega o Token para ler emails
        const tokenRes = await fetch(`${API_BASE}/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address, password })
        });
        
        const tokenData = await tokenRes.json();
        return { address, password, token: tokenData.token };
    } catch (e) {
        console.error("Erro no email:", e.message);
        return null;
    }
}

async function waitForLovableCode(accountObj) {
    // Tenta por 60 segundos
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
            const res = await fetch(`${API_BASE}/messages`, {
                headers: { "Authorization": `Bearer ${accountObj.token}` }
            });
            const data = await res.json();
            
            if (data['hydra:member'] && data['hydra:member'].length > 0) {
                const msgId = data['hydra:member'][0].id;
                const msgRes = await fetch(`${API_BASE}/messages/${msgId}`, {
                    headers: { "Authorization": `Bearer ${accountObj.token}` }
                });
                const fullMsg = await msgRes.json();
                
                // Procura link de login no corpo
                const match = fullMsg.text.match(/https:\/\/(?:lovable\.dev|.*\.lovable\.dev)\/(?:verify-email|login)\?token=[^\s"]+/);
                if (match) return match[0];
            }
        } catch (e) {}
    }
    return null;
}

module.exports = { createTempAccount, waitForLovableCode };