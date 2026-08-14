const { telegramRequest } = require("../telegram");

async function adminHelpCommand(message) {
  const response =
    `🛡️ Comandos administrativos\n\n` +
    `XP manual — responda à mensagem do membro:\n` +
    `/darxp quantidade motivo — entrega uma recompensa\n` +
    `/ajustarxp quantidade motivo — corrige o XP\n` +
    `/historico — mostra as alterações manuais\n\n` +
    `Catálogo de dardos:\n` +
    `/criarfranquia nome — cria uma franquia\n` +
    `/franquias — lista as franquias deste grupo\n` +
    `/adicionarpersonagem — abre o cadastro guiado\n` +
    `/personagens — lista os personagens cadastrados\n\n` +
    `Sem responder a uma mensagem:\n` +
    `/desfazerxp ID motivo — desfaz uma transação\n` +
    `/statusxp — mostra as regras de XP\n` +
    `/comandosadm — mostra esta lista\n\n` +
    `Jogo:\n` +
    `/dardos — mostra seus dardos e inicia um sorteio\n\n` +
    `O ID é o número mostrado depois de ` +
    `"Transação: #". Ele também aparece no /historico.`;

  await telegramRequest("sendMessage", {
    chat_id: message.chat.id,
    text: response,
  });
}

module.exports = {
  adminHelpCommand,
};
