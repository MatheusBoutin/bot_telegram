const { telegramRequest } = require("../telegram");

const ADMIN_HELP_TEXT = `🛡️ Guia administrativo

XP NO GRUPO

/darxp quantidade motivo — entrega uma recompensa de XP
/ajustarxp quantidade motivo — corrige o saldo de XP
/historico — mostra alterações manuais
/desfazerxp ID motivo — desfaz uma alteração manual
/comandosadm — abre este guia

📚 CATÁLOGO E ACERVO

/franquias — lista as franquias cadastradas
/criarfranquia — cadastra uma nova franquia
/excluirfranquia <ID> — remove uma franquia dos sorteios (somente no privado)
/cartas — lista as cartas e seus IDs (somente no privado)
/adicionarcarta — cadastra uma nova carta (somente no privado)
/excluircarta <ID> — remove uma carta dos sorteios (somente no privado)
/colecao — mostra as cartas que você já encontrou

Os comandos de catálogo são exclusivos do owner e administradores globais, exceto /colecao.`;

async function adminHelpCommand(message) { await telegramRequest("sendMessage", { chat_id: message.chat.id, text: ADMIN_HELP_TEXT }); }
module.exports = { ADMIN_HELP_TEXT, adminHelpCommand };
