const { telegramRequest } = require("../telegram");
const { getDartPlayer, getPlayableFranchises, getRenewalCountdown } = require("../services/dartGameService");
const { saveDartGameSession } = require("../services/dartGameSessionService");
const { getBotPrivateUrl } = require("../services/botIdentityService");

const PRIVATE_ONLY_TEXT = "O /acervo funciona somente no privado para não gerar spam no grupo.";

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
    await telegramRequest("sendMessage", { chat_id: message.chat.id, text: `📚 Você não possui explorações disponíveis.\n\nNovas explorações: ${getRenewalCountdown()}` });
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
    text: `📚 Acervo Literary\n\nAlgumas histórias só se revelam a quem abre o livro certo.\n\n📖 Explorações disponíveis: ${player.dartsAvailable}\n\nEscolha uma estante:`,
    reply_markup: buildFranchiseKeyboard(playableFranchises),
  });
}

async function privateOnlyAcervoNotice(message, overrides = {}) {
  const request = overrides.telegramRequest || telegramRequest;
  const resolvePrivateUrl = overrides.getBotPrivateUrl || getBotPrivateUrl;
  let privateUrl = null;
  try {
    privateUrl = await resolvePrivateUrl();
  } catch {
    // O aviso ainda é útil quando não é possível consultar a identidade do bot.
  }

  await request("sendMessage", {
    chat_id: message.chat.id,
    text: PRIVATE_ONLY_TEXT,
    ...(privateUrl
      ? {
          reply_markup: {
            inline_keyboard: [[{ text: "Abrir o acervo", url: privateUrl }]],
          },
        }
      : {}),
  });
}

const dartsCommand = acervoCommand;
module.exports = {
  acervoCommand,
  dartsCommand,
  privateOnlyAcervoNotice,
  buildFranchiseKeyboard,
  PRIVATE_ONLY_TEXT,
};
