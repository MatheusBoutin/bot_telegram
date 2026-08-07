const { User } = require("../database/models/User");

const {
  XP_MIN,
  XP_MAX,
  XP_COOLDOWN,
  MIN_MESSAGE_LENGTH,
  DUPLICATE_COOLDOWN,
  MAX_LEVEL,
  BASE_LEVEL_XP,
  LEVEL_XP_INCREASE,
} = require("../config/xpConfig");

async function getOrCreateUser(message) {
  const telegramId = message.from.id;

  let user = await User.findOne({
    where: {
      telegramId: telegramId,
    },
  });

  if (!user) {
    let username = null;

    if (message.from.username) {
      username = message.from.username;
    }

    user = await User.create({
      telegramId: telegramId,
      name: message.from.first_name,
      username: username,
      xp: 0,
      level: 1,
      messageCount: 0,
      lastXpAt: 0,
      lastMessage: "",
      lastMessageAt: 0,
    });

    console.log(`Novo usuário criado: ${user.name}`);

    return user;
  }

  // Atualiza o nível caso a fórmula tenha mudado.
  const correctLevel = calculateLevel(user.xp);

  if (user.level !== correctLevel) {
    user.level = correctLevel;
    await user.save();
  }

  return user;
}

function isValidXpMessage(message, user) {
  if (!message.text) {
    return false;
  }

  if (message.from.is_bot) {
    return false;
  }

  const text = message.text.trim();

  // Comandos não dão XP.
  if (text.startsWith("/")) {
    return false;
  }

  // Mensagens muito pequenas não dão XP.
  if (text.length < MIN_MESSAGE_LENGTH) {
    return false;
  }

  const now = Date.now();

  const lastMessage = user.lastMessage || "";

  const isSameMessage = text.toLowerCase() === lastMessage.toLowerCase();

  const lastMessageAt = Number(user.lastMessageAt);

  const timeSinceLastMessage = now - lastMessageAt;

  if (isSameMessage && timeSinceLastMessage < DUPLICATE_COOLDOWN) {
    return false;
  }

  return true;
}

function canGainXp(user) {
  const now = Date.now();

  const lastXpAt = Number(user.lastXpAt);

  const elapsedTime = now - lastXpAt;

  return elapsedTime >= XP_COOLDOWN;
}

function generateXp() {
  const possibleValues = XP_MAX - XP_MIN + 1;

  const randomNumber = Math.floor(Math.random() * possibleValues);

  return randomNumber + XP_MIN;
}

function getXpRequiredForNextLevel(level) {
  return BASE_LEVEL_XP + (level - 1) * LEVEL_XP_INCREASE;
}

function calculateLevel(totalXp) {
  let level = 1;
  let accumulatedXp = 0;

  while (level < MAX_LEVEL) {
    const requiredXp = getXpRequiredForNextLevel(level);

    if (totalXp < accumulatedXp + requiredXp) {
      break;
    }

    accumulatedXp += requiredXp;
    level += 1;
  }

  return level;
}

async function addXp(user, message) {
  const previousLevel = user.level;

  const xpGained = generateXp();

  user.xp += xpGained;
  user.messageCount += 1;

  user.lastXpAt = Date.now();
  user.lastMessage = message.text.trim();
  user.lastMessageAt = Date.now();

  user.level = calculateLevel(user.xp);

  await user.save();

  const leveledUp = user.level > previousLevel;

  return {
    xpGained: xpGained,
    leveledUp: leveledUp,
    previousLevel: previousLevel,
  };
}

module.exports = {
  getOrCreateUser,
  isValidXpMessage,
  canGainXp,
  generateXp,
  getXpRequiredForNextLevel,
  calculateLevel,
  addXp,
};
