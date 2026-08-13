const { telegramRequest } = require("../telegram");

const { getTitle } = require("../services/titleService");

const { ensureGroupAdmin } = require("../services/adminService");

const { getTargetFromReply } = require("../services/replyTargetService");

async function profileCommand(message, user, member, club) {
  let profileUser = user;
  let profileMember = member;

  const repliedUser = message.reply_to_message?.from;

  const isViewingAnotherUser =
    repliedUser && String(repliedUser.id) !== String(message.from.id);

  if (isViewingAnotherUser) {
    const userIsAdmin = await ensureGroupAdmin(message);

    if (!userIsAdmin) {
      return;
    }

    const target = await getTargetFromReply(message, club);

    if (!target.ok) {
      await telegramRequest("sendMessage", {
        chat_id: message.chat.id,
        text: target.error,
      });

      return;
    }

    profileUser = target.user;
    profileMember = target.member;
  }

  const title = getTitle(profileMember.level);

  const profileMessage =
    `👤 ${profileUser.name}\n\n` +
    `🏷️ Título: ${title}\n` +
    `⭐ Nível: ${profileMember.level}\n` +
    `✨ XP total: ${profileMember.xp}\n` +
    `💬 Mensagens com XP: ` +
    `${profileMember.messageCount}`;

  await telegramRequest("sendMessage", {
    chat_id: message.chat.id,
    text: profileMessage,
  });
}

module.exports = {
  profileCommand,
};
