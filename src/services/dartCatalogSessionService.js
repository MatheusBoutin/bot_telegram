const { DART_CATALOG_SESSION_DURATION_MS } = require("../config/dartConfig");

const catalogSessions = new Map();

function getSessionKey(clubId, userId) {
  return `${clubId}:${userId}`;
}

function saveCatalogSession(clubId, userId, sessionData) {
  const key = getSessionKey(clubId, userId);

  catalogSessions.set(key, {
    ...sessionData,
    expiresAt: Date.now() + DART_CATALOG_SESSION_DURATION_MS,
  });
}

function getCatalogSession(clubId, userId) {
  const key = getSessionKey(clubId, userId);
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

function clearCatalogSession(clubId, userId) {
  catalogSessions.delete(getSessionKey(clubId, userId));
}

module.exports = {
  saveCatalogSession,
  getCatalogSession,
  clearCatalogSession,
};
