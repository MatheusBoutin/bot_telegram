const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("dispatcher bloqueia acervo e dardos em grupo antes de criar usuário ou clube", () => {
  const source = read("src/handlers/messageHandler.js");
  const restriction = source.indexOf('["/acervo", "/dardos"].includes(commandName) && message.chat.type !== "private"');
  assert.ok(restriction >= 0);
  assert.ok(restriction < source.indexOf("const user = await getOrCreateUser(message)"));
  assert.ok(restriction < source.indexOf("const club = await getOrCreateClub(message)"));
  assert.ok(restriction < source.indexOf("handleCatalogUpload(message, user)"));
  assert.ok(restriction < source.indexOf("acervoCommand(message, user)"));
});

test("comandos direcionados ao username conservam a mesma restrição", () => {
  const { getCommandName } = require("../src/services/commandService");
  assert.equal(getCommandName("/acervo@meu_bot"), "/acervo");
  assert.equal(getCommandName("/dardos@meu_bot"), "/dardos");
});

test("deep link privado reutiliza o fluxo do acervo e coleção não é alterada", () => {
  const source = read("src/handlers/messageHandler.js");
  assert.match(source, /commandName === "\/start" && commandArguments\[0\]\?\.toLowerCase\(\) === "acervo" && message\.chat\.type === "private"/);
  assert.match(source, /return startAcervoCommand\(message\)/);
  assert.match(source, /return acervoCommand\(message, user\)/);
  assert.match(source, /if \(commandName === "\/colecao"\) return collectionCommand\(message, user\)/);
});

test("ajuda informa que o acervo funciona no privado e mantém dardos oculto", () => {
  const { HELP_TEXT } = require("../src/commands/helpCommand");
  assert.match(HELP_TEXT, /\/acervo — explore o acervo no privado/);
  assert.doesNotMatch(HELP_TEXT, /\/dardos/);
});

test("identidade válida monta deep link e identidade inválida não monta URL", async () => {
  const telegramPath = require.resolve("../src/telegram");
  const identityPath = require.resolve("../src/services/botIdentityService");
  const originalTelegram = require.cache[telegramPath];
  const originalIdentity = require.cache[identityPath];
  try {
    require.cache[telegramPath] = {
      id: telegramPath, filename: telegramPath, loaded: true,
      exports: { telegramRequest: async () => ({ username: "LiteraryBot" }) },
    };
    delete require.cache[identityPath];
    let identity = require(identityPath);
    assert.equal(await identity.getBotPrivateUrl(), "https://t.me/LiteraryBot?start=acervo");

    require.cache[telegramPath].exports.telegramRequest = async () => ({ username: "inválido" });
    delete require.cache[identityPath];
    identity = require(identityPath);
    assert.equal(await identity.getBotPrivateUrl(), null);
  } finally {
    if (originalTelegram) require.cache[telegramPath] = originalTelegram;
    else delete require.cache[telegramPath];
    if (originalIdentity) require.cache[identityPath] = originalIdentity;
    else delete require.cache[identityPath];
  }
});

test("aviso de grupo é enviado uma vez com botão para o privado", async () => {
  const { privateOnlyAcervoNotice, PRIVATE_ONLY_TEXT } = require("../src/commands/dartsCommand");
  const calls = [];
  await privateOnlyAcervoNotice(
    { chat: { id: -123, type: "group" } },
    {
      telegramRequest: async (method, body) => calls.push({ method, body }),
      getBotPrivateUrl: async () => "https://t.me/LiteraryBot?start=acervo",
    },
  );
  assert.deepEqual(calls, [{
    method: "sendMessage",
    body: {
      chat_id: -123,
      text: PRIVATE_ONLY_TEXT,
      reply_markup: {
        inline_keyboard: [[{
          text: "Abrir o acervo",
          url: "https://t.me/LiteraryBot?start=acervo",
        }]],
      },
    },
  }]);
});

test("falha ao obter identidade mantém somente o aviso curto", async () => {
  const { privateOnlyAcervoNotice, PRIVATE_ONLY_TEXT } = require("../src/commands/dartsCommand");
  const calls = [];
  await privateOnlyAcervoNotice(
    { chat: { id: -456, type: "supergroup" } },
    {
      telegramRequest: async (method, body) => calls.push({ method, body }),
      getBotPrivateUrl: async () => { throw new Error("getMe indisponível"); },
    },
  );
  assert.deepEqual(calls, [{
    method: "sendMessage",
    body: { chat_id: -456, text: PRIVATE_ONLY_TEXT },
  }]);
});
