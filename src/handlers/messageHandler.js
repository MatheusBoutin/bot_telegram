const { telegramRequest } = require("../telegram");

const { profileCommand } = require("../commands/profileCommand");
const { rankCommand } = require("../commands/rankCommand");

const { getTitle } = require("../services/titleService");
const { getOrCreateUser } = require("../services/userService");
const { getOrCreateClub } = require("../services/clubService");

const { getOrCreateClubMember } = require("../services/clubMemberService");

const { isValidXpMessage, canGainXp, addXp } = require("../services/xpService");

async function handleMessage(message) {
  if (!message.from) {
    return;
  }

  if (message.from.is_bot) {
    return;
  }

  const user = await getOrCreateUser(message);
  const club = await getOrCreateClub(message);
  const member = await getOrCreateClubMember(user, club);

  if (message.text === "/perfil") {
    await profileCommand(message, user, member);
    return;
  }

  if (message.text === "/rank") {
    await rankCommand(message, club);
    return;
  }

  if (message.text && message.text.startsWith("/")) {
    return;
  }

  if (!isValidXpMessage(message, member)) {
    return;
  }

  if (!canGainXp(member)) {
    return;
  }

  const result = await addXp(member, message);

  console.log(
    `${user.name} ganhou ${result.xpGained} XP em ${club.name}. ` +
      `Total: ${member.xp}`,
  );

  if (result.leveledUp) {
    const oldTitle = getTitle(result.previousLevel);
    const newTitle = getTitle(member.level);

    let levelUpMessage =
      `🎉 ${user.name} subiu de nível!\n\n` + `⭐ Novo nível: ${member.level}`;

    if (oldTitle !== newTitle) {
      levelUpMessage += `\n\n🏷️ Novo título desbloqueado:\n` + `${newTitle}`;
    }

    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,
      text: levelUpMessage,
    });
  }
}

module.exports = {
  handleMessage,
};
