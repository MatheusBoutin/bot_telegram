const { telegramRequest } = require("../telegram");

async function profileCommand(message, user) {
  const profileMessage =
    `👤 ${user.name}\n\n` +
    `⭐ Nível: ${user.level}\n` +
    `✨ XP: ${user.xp}\n` +
    `💬 Mensagens com XP: ${user.messageCount}`;

  await telegramRequest("sendMessage", {
    chat_id: message.chat.id,
    text: profileMessage,
  });
}

module.exports = {
  profileCommand,
};
