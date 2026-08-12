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

function isValidXpMessage(message, member) {
  if (!message.text) {
    return false;
  }

  if (message.from.is_bot) {
    return false;
  }

  const text = message.text.trim();

  if (text.startsWith("/")) {
    return false;
  }

  if (text.length < MIN_MESSAGE_LENGTH) {
    return false;
  }

  const now = Date.now();

  const lastMessage = member.lastMessage || "";

  const isSameMessage = text.toLowerCase() === lastMessage.toLowerCase();

  const lastMessageAt = Number(member.lastMessageAt);
  const timeSinceLastMessage = now - lastMessageAt;

  if (isSameMessage && timeSinceLastMessage < DUPLICATE_COOLDOWN) {
    return false;
  }

  return true;
}

function canGainXp(member) {
  const now = Date.now();
  const lastXpAt = Number(member.lastXpAt);
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

async function addXp(member, message) {
  const previousLevel = member.level;
  const xpGained = generateXp();

  member.xp += xpGained;
  member.messageCount += 1;

  member.lastXpAt = Date.now();
  member.lastMessage = message.text.trim();
  member.lastMessageAt = Date.now();

  member.level = calculateLevel(member.xp);

  await member.save();

  const leveledUp = member.level > previousLevel;

  return {
    xpGained: xpGained,
    leveledUp: leveledUp,
    previousLevel: previousLevel,
  };
}

module.exports = {
  isValidXpMessage,
  canGainXp,
  generateXp,
  getXpRequiredForNextLevel,
  calculateLevel,
  addXp,
};
