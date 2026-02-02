const fetch = require('node-fetch');

// Seu Token Oficial
const API_TOKEN = "mxq170fjalzxme688myeswecqahrrhv7yjw8ih60j3k4rvhlks0pfxvqnj2tgp6b";
const API_BASE = "https://api.tigrmail.com";

/**
 * Cria uma caixa de entrada (Inbox)
 * Documentação: POST /v1/inboxes
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

        if (!res.ok) {
            throw new Error(`Erro Tigrmail [${res.status}]: ${await res.text()}`);
        }

        const data = await res.json();
        console.log(`[EMAIL] 📧 Inbox Criada: ${data.inbox}`);
        return { address: data.inbox };

    } catch (e) {
        console.error("❌ Falha ao criar email:", e.message);
        return null;
    }
}

/**
 * Aguarda o E-mail chegar (Long Polling)
 * Documentação: GET /v1/messages
 * A API segura a conexão por até 3 minutos.
 */
async function waitForLovableCode(accountObj) {
    console.log(`[EMAIL] ⏳ Aguardando e-mail da Lovable em ${accountObj.address}...`);

    try {
        // Monta a URL com parâmetros (seguindo a doc CURL)
        const params = new URLSearchParams({
            inbox: accountObj.address,
            // Opcional: Filtra para garantir que vem da Lovable (evita spam)
            // Se der erro, remova esta linha, mas ajuda a ser preciso
            // fromDomain: "lovable.dev" 
        });

        // Timeout alto no fetch para não cortar a conexão antes dos 3 min da API
        const res = await fetch(`${API_BASE}/v1/messages?${params.toString()}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${API_TOKEN}`,
                "Content-Type": "application/json"
            },
            timeout: 190000 // 190 segundos (pouco mais que os 3 min da API)
        });

        if (!res.ok) {
            const errText = await res.text();
            // Erro 404 ou 408 geralmente significa que deu o tempo limite sem email
            console.log(`[EMAIL] ⚠️ Nenhuma mensagem recebida (Status: ${res.status} - ${errText})`);
            return null;
        }

        const data = await res.json();

        // A API retorna { message: { subject: "...", body: "..." } }
        if (data.message) {
            console.log(`[EMAIL] 📬 Recebido: "${data.message.subject}"`);
            
            const body = data.message.body;
            
            // Regex para achar o link (verify-email OU login)
            const match = body.match(/https:\/\/(?:www\.)?lovable\.dev\/(?:verify-email|login)\?token=[^\s"']+/);
            
            if (match) {
                console.log("[EMAIL] ✅ Link Mágico Encontrado!");
                return match[0];
            } else {
                console.log("[EMAIL] ⚠️ E-mail chegou, mas o link não foi reconhecido no regex padrão.");
                // Fallback: tenta pegar qualquer link grande
                const wideMatch = body.match(/https?:\/\/[^\s]+/g);
                if(wideMatch) {
                    const link = wideMatch.find(l => l.includes('token='));
                    if(link) return link;
                }
            }
        }

    } catch (e) {
        console.error(`[EMAIL] ❌ Erro na conexão: ${e.message}`);
    }

    return null;
}

module.exports = { createTempAccount, waitForLovableCode };