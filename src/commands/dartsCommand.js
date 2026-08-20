const { telegramRequest } = require("../telegram");
const { getDartPlayer, getPlayableFranchises } = require("../services/dartGameService");
const { saveDartGameSession } = require("../services/dartGameSessionService");

function buildFranchiseKeyboard(playableFranchises) {
  const rows = [];
  for (let index = 0; index < playableFranchises.length; index += 2) {
    rows.push(playableFranchises.slice(index, index + 2).map(({ franchise }) => ({
      text: franchise.name, callback_data: `darts:play:${franchise.id}`,
    })));
  }
  return { inline_keyboard: rows };
}

async function dartsCommand(message, user) {
  const player = await getDartPlayer(user);
  if (player.dartsAvailable <= 0) {
    await telegramRequest("sendMessage", { chat_id: message.chat.id, text: "🎯 Seus dardos de hoje acabaram. Volte amanhã!" });
    return;
  }
  const playableFranchises = await getPlayableFranchises();
  if (playableFranchises.length === 0) {
    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,
      text: "Ainda não há personagens disponíveis para jogar.\n\nPeça a um administrador global para cadastrar o catálogo.",
    });
    return;
  }
  saveDartGameSession(message.chat.id, user.id, {
    stage: "ready",
    franchiseIds: playableFranchises.map(({ franchise }) => franchise.id),
  });
  const label = player.dartsAvailable === 1 ? "dardo" : "dardos";
  await telegramRequest("sendMessage", {
    chat_id: message.chat.id,
    text: `🎯 Você tem ${player.dartsAvailable} ${label} hoje.\n\nEscolha a franquia para lançar:`,
    reply_markup: buildFranchiseKeyboard(playableFranchises),
  });
}

module.exports = { dartsCommand, buildFranchiseKeyboard };
