const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const telegramPath = require.resolve("../src/telegram");
const requests = [];

require.cache[telegramPath] = {
  id: telegramPath,
  filename: telegramPath,
  loaded: true,
  exports: {
    telegramRequest: async (method, body) => {
      requests.push({ method, body });
    },
  },
};

const { HELP_TEXT, helpCommand, isHelpCommand } = require("../src/commands/helpCommand");
const { getCommandName } = require("../src/services/commandService");

test.beforeEach(() => {
  requests.length = 0;
});

test("reconhece /ajuda e seus aliases", () => {
  assert.equal(isHelpCommand(getCommandName("/ajuda")), true);
  assert.equal(isHelpCommand(getCommandName("/help")), true);
  assert.equal(isHelpCommand(getCommandName("/start")), true);
});

test("reconhece comando de ajuda direcionado ao bot", () => {
  assert.equal(isHelpCommand(getCommandName("/ajuda@nome_do_bot")), true);
});

test("envia a ajuda como texto simples para o chat correto", async () => {
  await helpCommand({ chat: { id: 987654, type: "private" } });

  assert.deepEqual(requests, [{
    method: "sendMessage",
    body: { chat_id: 987654, text: HELP_TEXT },
  }]);
  assert.equal(requests[0].body.parse_mode, undefined);
});

test("ajuda apresenta os comandos de XP sem recursos ocultos ou administrativos", () => {
  for (const command of ["/literaryxp", "/rank", "/statusxp"]) {
    assert.match(HELP_TEXT, new RegExp(command));
  }

  assert.doesNotMatch(HELP_TEXT, /\/comandosadm|Administração|Biblioteca da Min/i);
  assert.doesNotMatch(HELP_TEXT, /dardo|carta|figurinha|franquia|catálogo/i);
});

test("handler atende ajuda antes de criar usuário, clube, associação ou entregar XP", () => {
  const handler = fs.readFileSync(
    path.join(__dirname, "..", "src/handlers/messageHandler.js"),
    "utf8",
  );
  const helpRoute = handler.indexOf("if (isHelpCommand(commandName)) return helpCommand(message)");

  assert.ok(helpRoute >= 0);
  assert.ok(helpRoute < handler.indexOf("const user = await getOrCreateUser(message)"));
  assert.ok(helpRoute < handler.indexOf("const club = await getOrCreateClub(message)"));
  assert.ok(helpRoute < handler.indexOf("const member = await getOrCreateClubMember(user, club)"));
  assert.ok(helpRoute < handler.indexOf("const result = await addXp(member, message)"));
});
