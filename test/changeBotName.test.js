const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { User, BotAdmin } = require("../src/database/models");
const telegram = require("../src/telegram");
const command = require("../src/commands/changeBotNameCommand");

const message = (overrides = {}) => ({
  from: { id: 123, is_bot: false },
  chat: { id: 123, type: "private" },
  text: "/trocarnome Literary Club",
  ...overrides,
});

async function withMocks({ ownerId = "123", user = null, adminResults = [] } = {}, run) {
  const previousOwner = process.env.BOT_OWNER_ID;
  const originals = { userFindOne: User.findOne, adminFindOne: BotAdmin.findOne, request: telegram.telegramRequest };
  const calls = [];
  let adminCheck = 0;
  process.env.BOT_OWNER_ID = ownerId;
  User.findOne = async () => user;
  BotAdmin.findOne = async () => (adminResults[adminCheck++] ? { active: true } : null);
  telegram.telegramRequest = async (method, body) => { calls.push({ method, body }); return true; };
  try {
    await run(calls);
  } finally {
    User.findOne = originals.userFindOne;
    BotAdmin.findOne = originals.adminFindOne;
    telegram.telegramRequest = originals.request;
    if (previousOwner === undefined) delete process.env.BOT_OWNER_ID;
    else process.env.BOT_OWNER_ID = previousOwner;
  }
}

test("owner troca o nome no privado e setMyName é chamado exatamente uma vez", { concurrency: false }, async () => {
  await withMocks({}, async (calls) => {
    await command.changeBotNameCommand(message());
    assert.deepEqual(calls.filter(({ method }) => method === "setMyName"), [
      { method: "setMyName", body: { name: "Literary Club" } },
    ]);
    assert.equal(calls.at(-1).body.text, "✅ Nome do bot atualizado para: Literary Club");
    assert.equal("parse_mode" in calls.at(-1).body, false);
  });
});

test("administrador global ativo troca o nome", { concurrency: false }, async () => {
  await withMocks({ ownerId: "999", user: { id: 7, telegramId: "123" }, adminResults: [true, true] }, async (calls) => {
    await command.changeBotNameCommand(message());
    assert.equal(calls.filter(({ method }) => method === "setMyName").length, 1);
  });
});

test("usuário comum é recusado", { concurrency: false }, async () => {
  await withMocks({ ownerId: "999", user: { id: 8, telegramId: "123" } }, async (calls) => {
    await command.changeBotNameCommand(message());
    assert.equal(calls.at(-1).body.text, command.UNAUTHORIZED_MESSAGE);
    assert.equal(calls.some(({ method }) => method === "setMyName"), false);
  });
});

test("administrador somente de grupo é recusado", { concurrency: false }, async () => {
  await withMocks({ ownerId: "999", user: { id: 8, telegramId: "123", groupAdmin: true } }, async (calls) => {
    await command.changeBotNameCommand(message());
    assert.equal(calls.at(-1).body.text, command.UNAUTHORIZED_MESSAGE);
  });
});

test("comando em grupo é recusado sem consultar User", { concurrency: false }, async () => {
  await withMocks({}, async (calls) => {
    User.findOne = async () => assert.fail("não deve consultar User");
    await command.changeBotNameCommand(message({ chat: { id: -1, type: "supergroup" } }));
    assert.equal(calls.at(-1).body.text, "Use este comando no privado do bot.");
  });
});

test("espaços internos e emoji são preservados, com trim nas extremidades", { concurrency: false }, async () => {
  await withMocks({}, async (calls) => {
    await command.changeBotNameCommand(message({ text: "/trocarnome   Literary  📚 Club   " }));
    assert.deepEqual(calls.find(({ method }) => method === "setMyName").body, { name: "Literary  📚 Club" });
  });
});

test("comando com username do bot funciona", { concurrency: false }, async () => {
  await withMocks({}, async (calls) => {
    await command.changeBotNameCommand(message({ text: "/trocarnome@literary_club_bot Literary Club" }));
    assert.equal(calls.find(({ method }) => method === "setMyName").body.name, "Literary Club");
  });
});

test("nome ausente ou apenas com espaços é recusado", { concurrency: false }, async () => {
  for (const text of ["/trocarnome", "/trocarnome   "]) {
    await withMocks({}, async (calls) => {
      await command.changeBotNameCommand(message({ text }));
      assert.equal(calls.at(-1).body.text, command.USAGE_MESSAGE);
    });
  }
});

test("nome acima de 64 caracteres é recusado", { concurrency: false }, async () => {
  await withMocks({}, async (calls) => {
    await command.changeBotNameCommand(message({ text: `/trocarnome ${"a".repeat(65)}` }));
    assert.equal(calls.at(-1).body.text, "O nome do bot pode ter no máximo 64 caracteres.");
  });
});

test("nome com quebra de linha é recusado", { concurrency: false }, async () => {
  await withMocks({}, async (calls) => {
    await command.changeBotNameCommand(message({ text: "/trocarnome Literary\nClub" }));
    assert.equal(calls.at(-1).body.text, command.USAGE_MESSAGE);
    assert.equal(calls.some(({ method }) => method === "setMyName"), false);
  });
});

test("autorização é revalidada imediatamente antes de setMyName", { concurrency: false }, async () => {
  await withMocks({ ownerId: "999", user: { id: 7, telegramId: "123" }, adminResults: [true, false] }, async (calls) => {
    await command.changeBotNameCommand(message());
    assert.equal(calls.some(({ method }) => method === "setMyName"), false);
    assert.equal(calls.at(-1).body.text, command.UNAUTHORIZED_MESSAGE);
  });
});

test("handler intercepta trocarnome antes de criação, sessões e XP", () => {
  const source = fs.readFileSync(require.resolve("../src/handlers/messageHandler"), "utf8");
  const commandIndex = source.indexOf('commandName === "/trocarnome"');
  assert.ok(commandIndex >= 0);
  for (const marker of [
    "getOrCreateUser(message)",
    "handleCatalogUpload(message, user)",
    "dartsCommand(message, user)",
    "getOrCreateClub(message)",
    "getOrCreateClubMember(user, club)",
    "addXp(member, message)",
  ]) assert.ok(commandIndex < source.indexOf(marker), `${marker} deve ocorrer depois de /trocarnome`);
});
