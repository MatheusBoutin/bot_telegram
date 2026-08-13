const { getOrCreateUserFromTelegramUser } = require("./userService");

const { getOrCreateClubMember } = require("./clubMemberService");

async function getTargetFromReply(message, club) {
  const repliedMessage = message.reply_to_message;

  if (!repliedMessage || !repliedMessage.from) {
    return {
      ok: false,
      error: "Responda à mensagem da pessoa que será selecionada.",
    };
  }

  if (repliedMessage.from.is_bot) {
    return {
      ok: false,
      error: "Bots não podem receber XP.",
    };
  }

  const user = await getOrCreateUserFromTelegramUser(repliedMessage.from);

  const member = await getOrCreateClubMember(user, club);

  return {
    ok: true,
    user,
    member,
  };
}

module.exports = {
  getTargetFromReply,
};
