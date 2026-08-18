const test = require("node:test");
const assert = require("node:assert/strict");
const { User, BotAdmin } = require("../src/database/models");
const telegram = require("../src/telegram");
const profileService = require("../src/services/botProfileService");
const command = require("../src/commands/changeBotPhotoCommand");

const photo = (id, fileSize = 100) => ({ file_id: id, file_size: fileSize });
const message = (overrides = {}) => ({
  from: { id: 123, is_bot: false }, chat: { id: 123, type: "private" },
  text: "/trocarfoto", ...overrides,
});

async function withCommandMocks({ ownerId = "123", user = null, admin = false, serviceResult = { ok: true } }, run) {
  const previousOwner = process.env.BOT_OWNER_ID;
  const originals = {
    userFindOne: User.findOne, adminFindOne: BotAdmin.findOne,
    request: telegram.telegramRequest, change: profileService.changeBotProfilePhoto,
  };
  const sent = [];
  process.env.BOT_OWNER_ID = ownerId;
  User.findOne = async () => user;
  BotAdmin.findOne = async () => admin ? { active: true } : null;
  telegram.telegramRequest = async (method, body) => { sent.push({ method, body }); return true; };
  profileService.changeBotProfilePhoto = async (selected, reauthorize) => {
    assert.equal(await reauthorize(), Boolean(ownerId === String(message().from.id) || admin));
    return typeof serviceResult === "function" ? serviceResult(selected) : serviceResult;
  };
  try { await run(sent); } finally {
    User.findOne = originals.userFindOne;
    BotAdmin.findOne = originals.adminFindOne;
    telegram.telegramRequest = originals.request;
    profileService.changeBotProfilePhoto = originals.change;
    if (previousOwner === undefined) delete process.env.BOT_OWNER_ID;
    else process.env.BOT_OWNER_ID = previousOwner;
  }
}

test("owner aceita foto direta na legenda e seleciona a maior versão", { concurrency: false }, async () => {
  await withCommandMocks({}, async (sent) => {
    let selected;
    profileService.changeBotProfilePhoto = async (value, reauthorize) => { selected = value; assert.equal(await reauthorize(), true); return { ok: true }; };
    await command.changeBotPhotoCommand(message({ text: undefined, caption: "/trocarfoto", photo: [photo("small"), photo("large")] }));
    assert.equal(selected.file_id, "large");
    assert.equal(sent.at(-1).body.text, "✅ Foto de perfil do bot atualizada.");
  });
});

test("administrador global aceita foto respondida", { concurrency: false }, async () => {
  await withCommandMocks({ ownerId: "999", user: { id: 7, telegramId: "123" }, admin: true }, async (sent) => {
    await command.changeBotPhotoCommand(message({ reply_to_message: { photo: [photo("reply")] } }));
    assert.equal(sent.at(-1).body.text, "✅ Foto de perfil do bot atualizada.");
  });
});

test("usuário comum e administrador apenas do grupo não recebem acesso global", { concurrency: false }, async () => {
  await withCommandMocks({ ownerId: "999", user: { id: 8, telegramId: "123", groupAdmin: true } }, async (sent) => {
    await command.changeBotPhotoCommand(message({ photo: [photo("x")] }));
    assert.equal(sent.at(-1).body.text, command.UNAUTHORIZED_MESSAGE);
  });
});

test("comando em grupo é recusado antes de consultar ou criar registros", { concurrency: false }, async () => {
  await withCommandMocks({}, async (sent) => {
    User.findOne = async () => assert.fail("não deve consultar User");
    await command.changeBotPhotoCommand(message({ chat: { id: -1, type: "supergroup" }, photo: [photo("x")] }));
    assert.equal(sent.at(-1).body.text, "Use este comando no privado do bot.");
  });
});

test("ausência de foto mostra instrução", { concurrency: false }, async () => {
  await withCommandMocks({}, async (sent) => {
    await command.changeBotPhotoCommand(message());
    assert.equal(sent.at(-1).body.text, "Envie uma foto com a legenda /trocarfoto ou responda a uma foto usando /trocarfoto.");
  });
});

test("serviço recusa file_size acima de 10 MB sem chamar Telegram", async () => {
  const api = { telegramRequest: async () => assert.fail(), downloadTelegramFile: async () => assert.fail(), telegramMultipartRequest: async () => assert.fail() };
  assert.deepEqual(await profileService.changeBotProfilePhoto(photo("x", profileService.MAX_PROFILE_PHOTO_BYTES + 1), async () => true, api), { ok: false, reason: "too_large" });
});

test("falha em getFile e ausência de file_path são erros controlados", async () => {
  await assert.rejects(profileService.changeBotProfilePhoto(photo("x"), async () => true, { telegramRequest: async () => { throw new Error("getFile falhou"); } }), /getFile falhou/);
  await assert.rejects(profileService.changeBotProfilePhoto(photo("x"), async () => true, { telegramRequest: async () => ({}) }), /caminho do arquivo/);
});

test("tamanho real acima do limite é recusado antes do multipart", async () => {
  let multipartCalled = false;
  const api = {
    telegramRequest: async () => ({ file_path: "photos/x.jpg" }),
    downloadTelegramFile: async () => Buffer.alloc(profileService.MAX_PROFILE_PHOTO_BYTES + 1),
    telegramMultipartRequest: async () => { multipartCalled = true; },
  };
  assert.deepEqual(await profileService.changeBotProfilePhoto(photo("x"), async () => true, api), { ok: false, reason: "too_large" });
  assert.equal(multipartCalled, false);
});

test("upload usa setMyProfilePhoto, attach e parte profile_photo após reautorizar", async () => {
  const calls = [];
  let authorized = false;
  const api = {
    telegramRequest: async (method, body) => { calls.push({ method, body }); return { file_path: "photos/x.jpg" }; },
    downloadTelegramFile: async () => Buffer.from("jpg"),
    telegramMultipartRequest: async (method, body) => calls.push({ method, body }),
  };
  assert.deepEqual(await profileService.changeBotProfilePhoto(photo("largest"), async () => { authorized = true; return true; }, api), { ok: true });
  assert.equal(calls[0].method, "getFile");
  assert.equal(calls[0].body.file_id, "largest");
  assert.equal(authorized, true);
  assert.equal(calls[1].method, "setMyProfilePhoto");
  assert.deepEqual(calls[1].body.fields.photo, { type: "static", photo: "attach://profile_photo" });
  assert.equal(calls[1].body.files[0].name, "profile_photo");
});

test("corpo multipart contém campo JSON e arquivo JPG", () => {
  const body = telegram.buildMultipartBody(
    { photo: { type: "static", photo: "attach://profile_photo" } },
    [{ name: "profile_photo", filename: "profile_photo.jpg", contentType: "image/jpeg", data: Buffer.from("BYTES") }],
    "boundary",
  ).toString("utf8");
  assert.match(body, /name="photo"/);
  assert.match(body, /attach:\/\/profile_photo/);
  assert.match(body, /name="profile_photo"; filename="profile_photo.jpg"/);
  assert.match(body, /Content-Type: image\/jpeg/);
  assert.match(body, /BYTES/);
});

test("falha da API gera mensagem amigável e log sem token", { concurrency: false }, async () => {
  const token = "123456:SECRET";
  const previousToken = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = token;
  const originalError = console.error;
  let logged = "";
  console.error = (...values) => { logged = values.join(" "); };
  try {
    await withCommandMocks({ serviceResult: () => { throw new Error(`https://api.telegram.org/bot${token}/setMyProfilePhoto`); } }, async (sent) => {
      profileService.changeBotProfilePhoto = async () => { throw new Error(`https://api.telegram.org/bot${token}/setMyProfilePhoto`); };
      await command.changeBotPhotoCommand(message({ photo: [photo("x")] }));
      assert.equal(sent.at(-1).body.text, "Não foi possível atualizar a foto do bot. Tente novamente.");
      assert.doesNotMatch(logged, new RegExp(token));
    });
  } finally {
    console.error = originalError;
    if (previousToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = previousToken;
  }
});

test("handler processa trocarfoto antes de criação e progressão", () => {
  const fs = require("node:fs");
  const source = fs.readFileSync(require.resolve("../src/handlers/messageHandler"), "utf8");
  const commandIndex = source.indexOf('commandName === "/trocarfoto"');
  assert.ok(commandIndex < source.indexOf("getOrCreateUser(message)"));
  assert.ok(commandIndex < source.indexOf("getOrCreateClub(message)"));
  assert.ok(commandIndex < source.indexOf("getOrCreateClubMember(user, club)"));
  assert.ok(commandIndex < source.indexOf("addXp(member, message)"));
  assert.match(source, /getCommandName\(message\.caption\)/);
});
