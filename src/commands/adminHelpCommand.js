const { telegramRequest } = require("../telegram");

const ADMIN_HELP_TEXT = `🛡️ Guia administrativo

NO GRUPO — RESPONDA AO MEMBRO/USUÁRIO

/darxp quantidade motivo — entrega uma recompensa de XP
/ajustarxp quantidade motivo — corrige o saldo com valor positivo ou negativo (apenas para correções)
/historico — mostra as alterações manuais da pessoa
/literaryxp — mostra o XP, nível e título da pessoa

NO GRUPO — NÃO PRECISA RESPONDER

/desfazerxp ID motivo — desfaz uma alteração manual
O ID de /desfazerxp é o número da transação mostrado na confirmação ou no /historico.
/statusxp — mostra as regras atuais do sistema de XP
/admliterary — mostra os administradores
/comandosadm — abre este guia

NO PRIVADO — OWNER E ADMINISTRADORES GLOBAIS

/meuid — mostra seu ID do Telegram
/daradmin ID — concede administração global
/removeradmin ID — remove administração global
/trocarfoto — troca a foto visível do bot
/trocarnome novo nome — troca o nome visível completo do bot

Em /trocarfoto, envie uma foto com o comando na legenda ou responda a uma foto com /trocarfoto.
/trocarnome Literary Club troca o nome completo, incluindo emoji. Esses comandos não alteram o @username do bot.

CATÁLOGO — NO GRUPO OU NO PRIVADO

Somente owner e administradores globais:
/criarfranquia Nome da franquia — cria uma franquia
/excluirfranquia Nome da franquia — exclui a franquia e seus personagens
/franquias — lista as franquias
/adicionarpersonagem — escolha a franquia, envie uma foto com a legenda Nome / raridade / descrição e confirme
/personagens — escolha uma franquia e veja os personagens

Na legenda, também é aceito Nome | raridade | descrição.`;

async function adminHelpCommand(message) {
  await telegramRequest("sendMessage", {
    chat_id: message.chat.id,
    text: ADMIN_HELP_TEXT,
  });
}

module.exports = {
  ADMIN_HELP_TEXT,
  adminHelpCommand,
};
