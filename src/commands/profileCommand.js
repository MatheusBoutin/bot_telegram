const { telegramRequest } = require("../telegram");
const { getTitle } = require("../services/titleService");

async function profileCommand(message, user) {
  const title = getTitle(user.level);

  const profileMessage =
    `👤 ${user.name}\n\n` +
    `🏷️ Título: ${title}\n` +
    `⭐ Nível: ${user.level}\n` +
    `✨ XP total: ${user.xp}\n` +
    `💬 Mensagens com XP: ${user.messageCount}`;

  await telegramRequest("sendMessage", {
    chat_id: message.chat.id,
    text: profileMessage,
  });
}

module.exports = {
  profileCommand,
};
