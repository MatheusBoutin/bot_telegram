const { DART_GAME_SESSION_DURATION_MS } = require("../config/dartGameConfig");

const dartGameSessions = new Map();
const processedCallbacks = new Map();
const MAX_PROCESSED_CALLBACKS = 10_000;

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

function clearDartGameSessionsForChat(chatId) {
  const prefix = `${chatId}:`;
  for (const key of dartGameSessions.keys()) {
    if (key.startsWith(prefix)) dartGameSessions.delete(key);
  }
}

function pruneProcessedCallbacks(now = Date.now()) {
  for (const [callbackQueryId, expiresAt] of processedCallbacks) {
    if (expiresAt <= now) processedCallbacks.delete(callbackQueryId);
  }
  while (processedCallbacks.size >= MAX_PROCESSED_CALLBACKS) {
    processedCallbacks.delete(processedCallbacks.keys().next().value);
  }
}

function hasProcessedDartCallback(callbackQueryId) {
  pruneProcessedCallbacks();
  return processedCallbacks.has(callbackQueryId);
}

function markDartCallbackProcessed(callbackQueryId) {
  pruneProcessedCallbacks();
  processedCallbacks.set(callbackQueryId, Date.now() + DART_GAME_SESSION_DURATION_MS);
}

function releaseDartCallback(callbackQueryId) {
  processedCallbacks.delete(callbackQueryId);
}

module.exports = {
  saveDartGameSession,
  getDartGameSession,
  clearDartGameSession,
  clearDartGameSessionsForChat,
  getSessionKey,
  hasProcessedDartCallback,
  markDartCallbackProcessed,
  releaseDartCallback,
};
