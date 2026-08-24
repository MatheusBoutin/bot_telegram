const { telegramRequest } = require("../telegram");

let cachedUsername;

function isValidTelegramUsername(username) {
  return typeof username === "string" && /^[A-Za-z0-9_]{5,32}$/.test(username);
}

async function getBotPrivateUrl() {
  if (cachedUsername === undefined) {
    const bot = await telegramRequest("getMe");
    cachedUsername = isValidTelegramUsername(bot?.username) ? bot.username : null;
  }

  return cachedUsername
    ? `https://t.me/${cachedUsername}?start=acervo`
    : null;
}

function clearCachedBotIdentity() {
  cachedUsername = undefined;
}

module.exports = { getBotPrivateUrl, clearCachedBotIdentity, isValidTelegramUsername };
