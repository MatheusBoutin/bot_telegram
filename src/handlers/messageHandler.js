const { telegramRequest } = require("../telegram");

const { profileCommand } = require("../commands/profileCommand");
const { rankCommand } = require("../commands/rankCommand");

const {
  getOrCreateUser,
  isValidXpMessage,
  canGainXp,
  addXp,
} = require("../services/xpService");

async function handleMessage(message) {
  if (!message.from) {
    return;
  }

  if (message.from.is_bot) {
    return;
  }

  const user = await getOrCreateUser(message);

  // =========================
  // COMANDO /perfil
  // =========================

  if (message.text === "/perfil") {
    await profileCommand(message, user);
    return;
  }

  // =========================
  // COMANDO /rank
  // =========================

  if (message.text === "/rank") {
    await rankCommand(message);
    return;
  }

  // =========================
  // OUTROS COMANDOS
  // =========================

  if (message.text) {
    if (message.text.startsWith("/")) {
      return;
    }
  }

  // =========================
  // XP
  // =========================

  if (!isValidXpMessage(message, user)) {
    return;
  }

  if (!canGainXp(user)) {
    return;
  }

  const result = await addXp(user, message);

  console.log(`${user.name} ganhou ${result.xpGained} XP. Total: ${user.xp}`);

  if (result.leveledUp) {
    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,
      text:
        `🎉 ${user.name} subiu de nível!\n\n` + `⭐ Novo nível: ${user.level}`,
    });
  }
}

module.exports = {
  handleMessage,
};
