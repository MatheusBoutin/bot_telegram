const { telegramRequest } = require("../telegram");

const { isGroupChat } = require("../services/adminService");

const {
  refreshDailyDarts,
  getPlayableFranchises,
} = require("../services/dartGameService");

const { saveDartGameSession } = require("../services/dartGameSessionService");

function buildFranchiseKeyboard(playableFranchises) {
  const rows = [];

  for (let index = 0; index < playableFranchises.length; index += 2) {
    rows.push(
      playableFranchises.slice(index, index + 2).map(({ franchise }) => {
        return {
          text: franchise.name,
          callback_data: `darts:play:${franchise.id}`,
        };
      }),
    );
  }

  return {
    inline_keyboard: rows,
  };
}

async function dartsCommand(message, user, club, member) {
  if (!isGroupChat(message.chat)) {
    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,

      text: "O jogo de dardos só funciona dentro de um grupo.",
    });

    return;
  }

  await refreshDailyDarts(member);

  if (member.dartsAvailable <= 0) {
    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,

      text: "🎯 Seus dardos de hoje acabaram. Volte amanhã!",
    });

    return;
  }

  const playableFranchises = await getPlayableFranchises(club);

  if (playableFranchises.length === 0) {
    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,

      text:
        "Ainda não há personagens disponíveis para jogar neste grupo.\n\n" +
        "Peça a um administrador para cadastrar uma franquia e personagens.",
    });

    return;
  }

  saveDartGameSession(club.id, user.id, {
    stage: "choosing_franchise",

    franchiseIds: playableFranchises.map(({ franchise }) => franchise.id),
  });

  const dartLabel = member.dartsAvailable === 1 ? "dardo" : "dardos";

  await telegramRequest("sendMessage", {
    chat_id: message.chat.id,

    text:
      `🎯 Você tem ${member.dartsAvailable} ` +
      `${dartLabel} hoje.\n\n` +
      "Escolha a franquia para lançar:",

    reply_markup: buildFranchiseKeyboard(playableFranchises),
  });
}

module.exports = {
  dartsCommand,
};
