const fetch = require('node-fetch');

// Token da TigrMail
const API_TOKEN = "mxq170fjalzxme688myeswecqahrrhv7yjw8ih60j3k4rvhlks0pfxvqnj2tgp6b";
const API_BASE = "https://api.tigrmail.com";

/**
 * Cria a caixa de e-mail
 */
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
        console.log(`[EMAIL] 📧 Email Gerado: ${data.inbox}`);
        return { address: data.inbox };
    } catch (e) {
        console.error("Erro ao gerar email:", e.message);
        return null;
    }
}

/**
 * Busca o link com LOOP (Polling) para evitar timeout do servidor
 * Tenta 30 vezes (30 x 5s = 2min e meio de espera total)
 */
async function waitForLovableCode(accountObj) {
    console.log(`[EMAIL] ⏳ Iniciando monitoramento para: ${accountObj.address}`);

    // Loop de tentativas (Short Polling)
    for (let attempt = 1; attempt <= 30; attempt++) {
        try {
            // URL da API
            const url = `${API_BASE}/v1/messages?inbox=${encodeURIComponent(accountObj.address)}`;

            // Faz a requisição esperando resposta rápida (não trava o servidor)
            const res = await fetch(url, {
                method: "GET",
                headers: { "Authorization": `Bearer ${API_TOKEN}` },
                timeout: 10000 // Timeout curto de 10s para a requisição em si
            });

            // Se der erro 404/500, apenas ignora e tenta de novo (pode ser que não chegou ainda)
            if (!res.ok) {
                process.stdout.write("."); // Log visual de espera (...)
            } else {
                const data = await res.json();

                // Se tiver mensagem
                if (data.message) {
                    console.log(`\n[EMAIL] 📬 CHEGOU! Assunto: "${data.message.subject}"`);
                    const body = data.message.body;
                    
                    // 1. Tenta achar link de login/verificação padrão
                    const match = body.match(/https:\/\/(?:www\.)?lovable\.dev\/(?:verify-email|login)\?token=[^\s"']+/);
                    if (match) {
                        console.log("[EMAIL] ✅ Link de Ativação Encontrado!");
                        return match[0];
                    }

                    // 2. Busca secundária (qualquer link com token)
                    const matchWide = body.match(/https?:\/\/[^\s]+/g);
                    if (matchWide) {
                         const target = matchWide.find(l => l.includes('lovable.dev') && l.includes('token='));
                         if (target) {
                             console.log("[EMAIL] ✅ Link (Genérico) Encontrado!");
                             return target;
                         }
                    }
                    console.log("[EMAIL] ⚠️ Email chegou mas sem link válido.");
                }
            }
        } catch (err) {
            // Ignora erros de rede temporários
            process.stdout.write("x");
        }
        
        // Espera 5 segundos antes da próxima tentativa
        await new Promise(r => setTimeout(r, 5000));
    }
    
    console.log("\n[EMAIL] ❌ Timeout: Desistindo após várias tentativas.");
    return null;
}

module.exports = { createTempAccount, waitForLovableCode };