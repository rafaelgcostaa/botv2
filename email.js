const fetch = require('node-fetch');

// Token da TigrMail
const API_TOKEN = "mxq170fjalzxme688myeswecqahrrhv7yjw8ih60j3k4rvhlks0pfxvqnj2tgp6b";
const API_BASE = "https://api.tigrmail.com";

async function createTempAccount() {
    try {
        console.log("[EMAIL] 🛠️ Solicitando nova inbox à API...");
        
        const res = await fetch(`${API_BASE}/v1/inboxes`, {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${API_TOKEN}`,
                "Content-Type": "application/json" 
            }
        });

        // Se a API der erro (401, 403, 500), mostre o motivo
        if (!res.ok) {
            const erroTexto = await res.text();
            console.error(`[EMAIL] ❌ Erro na API TigrMail (${res.status}): ${erroTexto}`);
            return null; 
        }

        const data = await res.json();

        // Verifica se o campo 'inbox' realmente veio
        if (!data.inbox) {
            console.error("[EMAIL] ❌ API respondeu, mas sem o campo 'inbox'. Resposta:", JSON.stringify(data));
            return null;
        }

        console.log(`[EMAIL] ✅ Email Criado com Sucesso: ${data.inbox}`);
        return { address: data.inbox };

    } catch (e) {
        console.error("[EMAIL] ❌ Falha crítica ao gerar email:", e.message);
        return null;
    }
}

async function waitForLovableCode(accountObj) {
    if (!accountObj || !accountObj.address) {
        console.error("[EMAIL] ❌ Erro: Tentei buscar mensagens para um email inválido.");
        return null;
    }

    console.log(`[EMAIL] ⏳ Monitorando caixa: ${accountObj.address}`);

    // Loop de 40 tentativas (aprox 3 minutos)
    for (let attempt = 1; attempt <= 40; attempt++) {
        try {
            const url = `${API_BASE}/v1/messages?inbox=${encodeURIComponent(accountObj.address)}`;
            
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
                    
                    // Regex 1: Padrão
                    const match = body.match(/https:\/\/(?:www\.)?lovable\.dev\/(?:verify-email|login)\?token=[^\s"']+/);
                    if (match) return match[0];

                    // Regex 2: Genérico
                    const matchWide = body.match(/https?:\/\/[^\s]+/g);
                    if (matchWide) {
                         const target = matchWide.find(l => l.includes('token='));
                         if (target) return target;
                    }
                }
            }
        } catch (err) { process.stdout.write("."); }
        
        await new Promise(r => setTimeout(r, 5000));
    }
    return null;
}

module.exports = { createTempAccount, waitForLovableCode };
