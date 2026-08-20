const test = require("node:test");
const assert = require("node:assert/strict");

const telegramPath = require.resolve("../src/telegram");
const botAdminServicePath = require.resolve("../src/services/botAdminService");
const requests = [];
let authorized = false;

require.cache[telegramPath] = {
  id: telegramPath,
  filename: telegramPath,
  loaded: true,
  exports: {
    telegramRequest: async (method, body) => {
      requests.push({ method, body });
      return true;
    },
  },
};

require.cache[botAdminServicePath] = {
  id: botAdminServicePath,
  filename: botAdminServicePath,
  loaded: true,
  exports: { canManageBot: async () => authorized },
};

const { ensureGlobalAdmin } = require("../src/handlers/messageHandler");

test.beforeEach(() => {
  requests.length = 0;
  authorized = false;
});

test("admin apenas do grupo não recebe poderes administrativos do bot", async () => {
  const allowed = await ensureGlobalAdmin(
    { chat: { id: -1001 }, from: { id: 22, groupAdmin: true } },
    { id: 7, telegramId: "22" },
  );

  assert.equal(allowed, false);
  assert.equal(requests.length, 1);
  assert.match(requests[0].body.text, /administradores globais/);
});

test("admin global ativo recebe poderes administrativos do bot", async () => {
  authorized = true;
  const allowed = await ensureGlobalAdmin(
    { chat: { id: -1001 }, from: { id: 22 } },
    { id: 7, telegramId: "22" },
  );

  assert.equal(allowed, true);
  assert.deepEqual(requests, []);
});
