const { DART_GAME_SESSION_DURATION_MS } = require("../config/dartGameConfig");

const dartGameSessions = new Map();

function getSessionKey(clubId, userId) {
  return `${clubId}:${userId}`;
}

function saveDartGameSession(clubId, userId, sessionData) {
  dartGameSessions.set(getSessionKey(clubId, userId), {
    ...sessionData,
    expiresAt: Date.now() + DART_GAME_SESSION_DURATION_MS,
  });
}

function getDartGameSession(clubId, userId) {
  const key = getSessionKey(clubId, userId);

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

function clearDartGameSession(clubId, userId) {
  dartGameSessions.delete(getSessionKey(clubId, userId));
}

module.exports = {
  saveDartGameSession,
  getDartGameSession,
  clearDartGameSession,
};
