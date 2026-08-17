const { DART_GAME_SESSION_DURATION_MS } = require("../config/dartGameConfig");

const dartGameSessions = new Map();

function getSessionKey(chatId, userId) {
  return `${chatId}:${userId}`;
}

function saveDartGameSession(chatId, userId, sessionData) {
  dartGameSessions.set(getSessionKey(chatId, userId), {
    ...sessionData,
    expiresAt: Date.now() + DART_GAME_SESSION_DURATION_MS,
  });
}

function getDartGameSession(chatId, userId) {
  const key = getSessionKey(chatId, userId);

  const session = dartGameSessions.get(key);

  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    dartGameSessions.delete(key);
    return null;
  }

  return session;
}

function clearDartGameSession(chatId, userId) {
  dartGameSessions.delete(getSessionKey(chatId, userId));
}

module.exports = {
  saveDartGameSession,
  getDartGameSession,
  clearDartGameSession,
  getSessionKey,
};
