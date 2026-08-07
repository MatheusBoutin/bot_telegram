const { User } = require("../database/models/User");
const { telegramRequest } = require("../telegram");

async function rankCommand(message) {
  const ranking = await User.findAll({
    order: [["xp", "DESC"]],
    limit: 10,
  });

  if (ranking.length === 0) {
    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,
      text: "Ainda não existem usuários no ranking.",
    });

    return;
  }

  let rankingMessage = "🏆 Ranking do Clube\n\n";

  for (let index = 0; index < ranking.length; index++) {
    const user = ranking[index];

    let position = `${index + 1}.`;

    if (index === 0) {
      position = "🥇";
    }

    if (index === 1) {
      position = "🥈";
    }

    if (index === 2) {
      position = "🥉";
    }

    rankingMessage +=
      `${position} ${user.name}` +
      ` — Nível ${user.level}` +
      ` — ${user.xp} XP\n`;
  }

  await telegramRequest("sendMessage", {
    chat_id: message.chat.id,
    text: rankingMessage,
  });
}

module.exports = {
  rankCommand,
};
