const fetch = require('node-fetch');

// Token da TigrMail
const API_TOKEN = "mxq170fjalzxme688myeswecqahrrhv7yjw8ih60j3k4rvhlks0pfxvqnj2tgp6b";
const API_BASE = "https://api.tigrmail.com";

/**
 * Cria uma nova caixa de entrada na TigrMail
 */
async function createTempAccount() {
    try {
        const res = await fetch(`${API_BASE}/v1/inboxes`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_TOKEN}`
            }
        });

        if (!res.ok) {
            throw new Error(`Erro API TigrMail: ${res.status} ${await res.text()}`);
        }

        const data = await res.json();
        const address = data.inbox;
        
        console.log(`[EMAIL] 📧 Email Gerado (TigrMail): ${address}`);
        
        // Retorna no formato que o engine.js espera
        return { address };
    } catch (e) {
        console.error("Erro ao gerar email:", e.message);
        return null;
    }
}

/**
 * Aguarda o email chegar. 
 * A TigrMail segura a conexão (long polling) até chegar algo ou dar timeout.
 */
async function waitForLovableCode(accountObj) {
    console.log(`[EMAIL] ⏳ Aguardando email da Lovable em: ${accountObj.address}...`);

    try {
        // Monta a URL para buscar mensagens na caixa criada
        const url = `${API_BASE}/v1/messages?inbox=${encodeURIComponent(accountObj.address)}`;

        const res = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${API_TOKEN}`
            }
        });

        const data = await res.json();

        // Se houver erro ou timeout sem mensagem
        if (!res.ok || data.error) {
            console.log(`[EMAIL] ⚠️ Nenhuma mensagem recebida ou erro: ${data.error || res.status}`);
            return null;
        }

        // Se chegou mensagem
        if (data.message) {
            const subject = data.message.subject;
            const body = data.message.body;
            
            console.log(`[EMAIL] 📬 Email recebido! Assunto: ${subject}`);

            // Busca o Link Mágico no corpo
            const match = body.match(/https:\/\/(?:www\.)?lovable\.dev\/(?:verify-email|login)\?token=[^\s"']+/);
            
            if (match) {
                console.log("[EMAIL] ✅ Link encontrado!");
                return match[0];
            } else {
                console.log("[EMAIL] ⚠️ Email chegou mas não achei o link padrão. Tentando busca ampla...");
                // Fallback
                const matchWide = body.match(/https?:\/\/[^\s]+/g);
                if (matchWide) {
                     const target = matchWide.find(l => l.includes('lovable.dev') && l.includes('token='));
                     if (target) return target;
                }
            }
        }

    } catch (err) {
        console.error(`[EMAIL] Erro crítico na busca: ${err.message}`);
    }
    
    return null;
}

module.exports = { createTempAccount, waitForLovableCode };