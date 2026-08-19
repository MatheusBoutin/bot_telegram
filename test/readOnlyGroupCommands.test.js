const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const telegramPath = require.resolve("../src/telegram");
const modelsPath = require.resolve("../src/database/models");
const requests = [];

require.cache[telegramPath] = {
  id: telegramPath,
  filename: telegramPath,
  loaded: true,
  exports: {
    telegramRequest: async (method, body) => {
      requests.push({ method, body });
      if (method === "getChatAdministrators") {
        return [
          { status: "creator", user: { id: 10, first_name: "Ana", last_name: "Silva" } },
          { status: "administrator", user: { id: 11, username: "bia" } },
          { status: "administrator", user: { id: 12, first_name: "Bot", is_bot: true } },
        ];
      }
      return true;
    },
  },
};

const models = require(modelsPath);
const originalClubMemberCount = models.ClubMember.count;
const originalTransactionCount = models.XpTransaction.count;
const { listAdminsCommand } = require("../src/commands/botAdminCommand");
const { xpStatusCommand } = require("../src/commands/xpStatusCommand");

test.beforeEach(() => {
  requests.length = 0;
});

test.after(() => {
  models.ClubMember.count = originalClubMemberCount;
  models.XpTransaction.count = originalTransactionCount;
});

test("membro comum consulta os administradores do grupo", async () => {
  await listAdminsCommand({
    chat: { id: -1001, type: "supergroup" },
    from: { id: 99 },
  });

  assert.deepEqual(requests[0], {
    method: "getChatAdministrators",
    body: { chat_id: -1001 },
  });
  assert.deepEqual(requests[1], {
    method: "sendMessage",
    body: {
      chat_id: -1001,
      text: "Administradores do grupo\n\n• Ana Silva\n• @bia",
    },
  });
});

test("membro comum consulta o status de XP sem validação administrativa", async () => {
  models.ClubMember.count = async () => 8;
  models.XpTransaction.count = async () => 3;

  await xpStatusCommand(
    { chat: { id: -1002, type: "group" }, from: { id: 99 } },
    { id: 7, name: "Clube" },
  );

  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, "sendMessage");
  assert.equal(requests[0].body.chat_id, -1002);
  assert.match(requests[0].body.text, /Status do XP/);
});

test("handler libera consultas e mantém alterações de XP restritas", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "src/handlers/messageHandler.js"),
    "utf8",
  );
  const protectedSet = source.match(/const groupAdminCommands = new Set\(\[([^\]]+)]\)/)?.[1] || "";

  for (const command of ["/darxp", "/ajustarxp", "/historico", "/desfazerxp"]) {
    assert.match(protectedSet, new RegExp(command));
  }
  assert.doesNotMatch(protectedSet, /\/statusxp|\/admliterary/);
  assert.match(source, /commandName === "\/admliterary"\) return listAdminsCommand\(message\)/);
  assert.match(source, /commandName === "\/statusxp"\) return xpStatusCommand\(message, club\)/);
  assert.match(source, /if \(!\(await ensureGroupAdmin\(message\)\)\) return/);
});
