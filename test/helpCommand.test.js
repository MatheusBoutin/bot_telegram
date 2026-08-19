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

const {
  HELP_TEXT,
  helpCommand,
  isHelpCommand,
} = require("../src/commands/helpCommand");
const {
  ADMIN_HELP_TEXT,
  adminHelpCommand,
} = require("../src/commands/adminHelpCommand");
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

  assert.deepEqual(requests, [
    {
      method: "sendMessage",
      body: { chat_id: 987654, text: HELP_TEXT },
    },
  ]);
  assert.equal(requests[0].body.parse_mode, undefined);
});

test("ajuda mostra exatamente os comandos disponíveis para membros", () => {
  assert.equal(
    HELP_TEXT,
    `✨ Guia de comandos

/literaryxp — mostra seu XP, nível e título

/rank — mostra o ranking de XP do grupo

/statusxp — explica como o sistema de XP funciona

/admliterary — mostra os administradores

/ajuda — abre este guia`,
  );

  assert.doesNotMatch(
    HELP_TEXT,
    /\/darxp|\/ajustarxp|\/historico|\/desfazerxp/i,
  );
  assert.doesNotMatch(
    HELP_TEXT,
    /responda|respondendo|gerenciamento|ajuste de XP/i,
  );
});

test("ajuda administrativa separa local e modo de uso", () => {
  assert.match(ADMIN_HELP_TEXT, /NO GRUPO — RESPONDA AO MEMBRO/);
  assert.match(ADMIN_HELP_TEXT, /NO GRUPO — NÃO PRECISA RESPONDER/);
  assert.match(ADMIN_HELP_TEXT, /NO PRIVADO — OWNER E ADMINISTRADORES GLOBAIS/);
  assert.match(ADMIN_HELP_TEXT, /CATÁLOGO — NO GRUPO OU NO PRIVADO/);

  for (const command of [
    "/darxp",
    "/ajustarxp",
    "/historico",
    "/literaryxp",
    "/desfazerxp",
    "/statusxp",
    "/comandosadm",
    "/meuid",
    "/daradmin",
    "/removeradmin",
    "/admliterary",
    "/trocarfoto",
    "/trocarnome",
    "/criarfranquia",
    "/franquias",
    "/adicionarpersonagem",
    "/personagens",
  ]) {
    assert.match(ADMIN_HELP_TEXT, new RegExp(command));
  }

  assert.match(ADMIN_HELP_TEXT, /não alteram o @username/i);
  assert.match(
    ADMIN_HELP_TEXT,
    /ID de \/desfazerxp.*confirmação ou no \/historico/i,
  );
  assert.match(
    ADMIN_HELP_TEXT,
    /foto com o comando na legenda.*responda a uma foto/i,
  );
  assert.match(ADMIN_HELP_TEXT, /Nome \/ raridade \/ descrição/);
  assert.match(ADMIN_HELP_TEXT, /Nome \| raridade \| descrição/);
});

test("ajuda administrativa é enviada como texto simples para o chat correto", async () => {
  await adminHelpCommand({ chat: { id: -100123456, type: "supergroup" } });

  assert.deepEqual(requests, [
    {
      method: "sendMessage",
      body: { chat_id: -100123456, text: ADMIN_HELP_TEXT },
    },
  ]);
  assert.equal(requests[0].body.parse_mode, undefined);
});

test("nenhuma ajuda usa o exemplo 42 e ambas cabem em uma mensagem", () => {
  for (const text of [HELP_TEXT, ADMIN_HELP_TEXT]) {
    assert.doesNotMatch(text, /42/);
    assert.ok(text.length < 4096);
  }
});

test("handler atende ajuda antes de criar usuário, clube, associação ou entregar XP", () => {
  const handler = fs.readFileSync(
    path.join(__dirname, "..", "src/handlers/messageHandler.js"),
    "utf8",
  );
  const helpRoute = handler.indexOf(
    "if (isHelpCommand(commandName)) return helpCommand(message)",
  );

  assert.ok(helpRoute >= 0);
  assert.ok(
    helpRoute < handler.indexOf("const user = await getOrCreateUser(message)"),
  );
  assert.ok(
    helpRoute < handler.indexOf("const club = await getOrCreateClub(message)"),
  );
  assert.ok(
    helpRoute <
      handler.indexOf("const member = await getOrCreateClubMember(user, club)"),
  );
  assert.ok(
    helpRoute < handler.indexOf("const result = await addXp(member, message)"),
  );
});

test("comandos de ajuda retornam antes da entrega automática de XP", () => {
  const handler = fs.readFileSync(
    path.join(__dirname, "..", "src/handlers/messageHandler.js"),
    "utf8",
  );
  const automaticXp = handler.indexOf(
    "const result = await addXp(member, message)",
  );

  assert.ok(
    handler.indexOf(
      "if (isHelpCommand(commandName)) return helpCommand(message)",
    ) < automaticXp,
  );
  assert.ok(
    handler.indexOf(
      'else if (commandName === "/comandosadm") await adminHelpCommand(message)',
    ) < automaticXp,
  );
});
