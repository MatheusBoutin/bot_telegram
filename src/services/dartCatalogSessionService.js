const { DART_CATALOG_SESSION_DURATION_MS } = require("../config/dartConfig");

const catalogSessions = new Map();

function getSessionKey(chatId, userId) {
  return `${chatId}:${userId}`;
}

function saveCatalogSession(chatId, userId, sessionData) {
  const key = getSessionKey(chatId, userId);

  catalogSessions.set(key, {
    ...sessionData,
    expiresAt: Date.now() + DART_CATALOG_SESSION_DURATION_MS,
  });
}

function getCatalogSession(chatId, userId) {
  const key = getSessionKey(chatId, userId);
  const session = catalogSessions.get(key);

  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    catalogSessions.delete(key);
    return null;
  }

  return session;
}

function clearCatalogSession(chatId, userId) {
  catalogSessions.delete(getSessionKey(chatId, userId));
}

function clearCatalogSessionsForFranchise(franchiseId) {
  for (const [key, session] of catalogSessions) {
    if (Number(session.franchiseId) === Number(franchiseId)) catalogSessions.delete(key);
  }
}

module.exports = {
  saveCatalogSession,
  getCatalogSession,
  clearCatalogSession,
  getSessionKey,
  clearCatalogSessionsForFranchise,
};
