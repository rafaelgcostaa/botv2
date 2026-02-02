const fetch = require('node-fetch');

// Token da TigrMail
const API_TOKEN = "mxq170fjalzxme688myeswecqahrrhv7yjw8ih60j3k4rvhlks0pfxvqnj2tgp6b";
const API_BASE = "https://api.tigrmail.com";

async function createTempAccount() {
    try {
        console.log("[EMAIL] 🛠️ Criando nova inbox...");
        const res = await fetch(`${API_BASE}/v1/inboxes`, {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${API_TOKEN}`,
                "Content-Type": "application/json" 
            }
        });
        const data = await res.json();
        console.log(`[EMAIL] ✅ Inbox Criada: ${data.inbox}`);
        return { address: data.inbox };
    } catch (e) {
        console.error("❌ Erro ao gerar email:", e.message);
        return null;
    }
}

async function waitForLovableCode(accountObj) {
    console.log(`[EMAIL] 🕵️ Iniciando busca na caixa: ${accountObj.address}`);

    // Tenta por 3 minutos (36 tentativas de 5s)
    for (let attempt = 1; attempt <= 36; attempt++) {
        try {
            process.stdout.write(`[EMAIL] ⏳ Tentativa ${attempt}/36... `);

            const url = `${API_BASE}/v1/messages?inbox=${encodeURIComponent(accountObj.address)}`;
            
            const res = await fetch(url, {
                method: "GET",
                headers: { "Authorization": `Bearer ${API_TOKEN}` },
                timeout: 10000 
            });

            if (res.ok) {
                const data = await res.json();
                
                // Se a API retornou um objeto "message", é porque CHEGOU!
                if (data.message) {
                    console.log(`\n\n[EMAIL] 🔔 MENSAGEM RECEBIDA!`);
                    console.log(`[EMAIL] Assunto: "${data.message.subject}"`);
                    console.log(`[EMAIL] Remetente: "${data.message.from}"`);
                    
                    const body = data.message.body;
                    
                    // TENTA EXTRAIR O LINK AGORA (Não busca mais na API)
                    
                    // 1. Regex Padrão (Link de Login/Verify)
                    const match = body.match(/https:\/\/(?:www\.)?lovable\.dev\/(?:verify-email|login)\?token=[^\s"']+/);
                    if (match) {
                        console.log("[EMAIL] 🎯 Link Mágico (Padrão) Encontrado!");
                        return match[0];
                    }

                    // 2. Regex Genérico (Qualquer link Lovable com token)
                    console.log("[EMAIL] ⚠️ Link padrão não achado. Tentando busca bruta...");
                    const matchWide = body.match(/https?:\/\/[^\s]+/g);
                    if (matchWide) {
                         const target = matchWide.find(l => l.includes('lovable.dev') && l.includes('token='));
                         if (target) {
                             console.log("[EMAIL] 🎯 Link (Genérico) Encontrado!");
                             return target;
                         }
                    }

                    // Se chegou aqui, leu o email mas não achou link.
                    console.log("[EMAIL] ❌ O email chegou, mas não achei nenhum link válido no corpo.");
                    console.log("[DEBUG CORPO DO EMAIL]:", body.substring(0, 200) + "..."); // Mostra o começo do email
                    return null; // Retorna null para abortar, pois o email já foi consumido
                } else {
                    console.log("Nada ainda.");
                }
            } else {
                console.log(`Erro API: ${res.status}`);
            }
        } catch (err) { 
            console.log(`Erro Rede: ${err.message}`);
        }
        
        // Espera 5s
        await new Promise(r => setTimeout(r, 5000));
    }
    
    console.log("\n[EMAIL] ❌ Timeout: Desistindo após 3 minutos.");
    return null;
}

module.exports = { createTempAccount, waitForLovableCode };
