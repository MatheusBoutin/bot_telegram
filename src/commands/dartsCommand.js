const { telegramRequest } = require("../telegram");
const { getDartPlayer, getPlayableFranchises, getRenewalCountdown } = require("../services/dartGameService");
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

async function acervoCommand(message, user) {
  const player = await getDartPlayer(user);
  if (player.dartsAvailable <= 0) {
    await telegramRequest("sendMessage", { chat_id: message.chat.id, text: `📚 O acervo encerrou suas explorações por hoje.\n\nNovas explorações: ${getRenewalCountdown()}` });
    return;
  }
  const playableFranchises = await getPlayableFranchises();
  if (playableFranchises.length === 0) {
    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,
      text: "Ainda não há cartas disponíveis no acervo.\n\nPeça a um administrador global para cadastrar o catálogo.",
    });
    return;
  }
  saveDartGameSession(message.chat.id, user.id, {
    stage: "ready",
    franchiseIds: playableFranchises.map(({ franchise }) => franchise.id),
  });
  await telegramRequest("sendMessage", {
    chat_id: message.chat.id,
    text: `📚 Acervo Literary\n\nAlgumas histórias só se revelam a quem abre o livro certo.\n\nExplorações disponíveis hoje: ${player.dartsAvailable}/3\n\nEscolha uma estante:`,
    reply_markup: buildFranchiseKeyboard(playableFranchises),
  });
}

const dartsCommand = acervoCommand;
module.exports = { acervoCommand, dartsCommand, buildFranchiseKeyboard };
