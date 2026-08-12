const { telegramRequest } = require("../telegram");
const { getTitle } = require("../services/titleService");

async function profileCommand(message, user, member) {
  const title = getTitle(member.level);

  const profileMessage =
    `👤 ${user.name}\n\n` +
    `🏷️ Título: ${title}\n` +
    `⭐ Nível: ${member.level}\n` +
    `✨ XP total: ${member.xp}\n` +
    `💬 Mensagens com XP: ${member.messageCount}`;

  await telegramRequest("sendMessage", {
    chat_id: message.chat.id,
    text: profileMessage,
  });
}

module.exports = {
  profileCommand,
};
