const { telegramRequest } = require("../telegram");

async function adminHelpCommand(message) {
  const response =
    `🛡️ Comandos administrativos\n\n` +
    `Responda à mensagem do membro:\n` +
    `/perfil — mostra o perfil do membro\n` +
    `/darxp quantidade motivo — entrega uma recompensa\n` +
    `/ajustarxp quantidade motivo — corrige o XP\n` +
    `/historico — mostra as alterações manuais\n\n` +
    `Use sem responder:\n` +
    `/desfazerxp ID motivo — desfaz uma transação\n` +
    `/statusxp — mostra as regras de XP\n` +
    `/comandosadm — mostra esta lista\n\n` +
    `/perfil usado sem responder mostra o seu próprio perfil.\n\n` +
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
