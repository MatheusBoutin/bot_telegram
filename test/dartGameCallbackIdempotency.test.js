const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createDartGameCallbackHandler, isInvalidTelegramFile } = require("../src/handlers/dartGameCallbackHandler");
const { CARD_REVEAL_DELAY_MS } = require("../src/config/dartGameConfig");
const { processUpdateWithRetry } = require("../src/services/pollingService");
const sessions = require("../src/services/dartGameSessionService");

const query = (id = "callback-1") => ({
  id,
  data: "darts:open:7",
  from: { id: 99, first_name: "Leitora" },
  message: { message_id: 55, chat: { id: 10, type: "private" } },
});

function harness(options = {}) {
  let session = { stage: "shelf_selected", franchiseIds: [7], franchiseId: 7 };
  const processed = new Set();
  const calls = [];
  const events = [];
  const delayCalls = [];
  const counts = { consume: 0, refund: 0, collection: 0 };
  const photoError = options.photoError;
  const diceError = options.diceError;
  const collectionError = options.collectionError;
  const telegramRequest = async (method, body) => {
    calls.push({ method, body });
    events.push(method);
    if (method === "sendAnimation" && diceError) throw diceError;
    if (method === "sendPhoto" && photoError) throw photoError;
    return { ok: true };
  };
  const handler = createDartGameCallbackHandler({
    telegramRequest,
    getOrCreateUser: async () => ({ id: 1 }),
    getDartGameSession: () => session,
    saveDartGameSession: (_chatId, _userId, value) => { session = value; },
    hasProcessedDartCallback: (id) => processed.has(id),
    markDartCallbackProcessed: (id) => processed.add(id),
    releaseDartCallback: (id) => processed.delete(id),
    findPlayableFranchise: async () => ({ id: 7, name: "Saga" }),
    consumeDart: options.consumeDart || (async () => { counts.consume += 1; return { consumed: true, remainingDarts: 2 }; }),
    refundDart: async () => { counts.refund += 1; },
    drawCharacter: async () => ({
      id: 8, name: "Heroína", rarity: "rare", description: "Descrição", imageFileId: "telegram-file-id",
    }),
    registerObtainedCharacter: async () => {
      counts.collection += 1;
      events.push("registerCollection");
      if (collectionError) throw collectionError;
    },
    delay: options.delay || (async (milliseconds) => {
      delayCalls.push(milliseconds);
      events.push("delay");
    }),
    bookAnimation: "book-file-id",
  });
  return { handler, calls, counts, events, delayCalls, getSession: () => session };
}

const methods = (state, method) => state.calls.filter((call) => call.method === method);

test("sorteio normal consome, anima, revela e registra uma vez", async () => {
  const state = harness();
  await state.handler(query(), { updateId: 100 });
  assert.equal(state.counts.consume, 1);
  assert.equal(methods(state, "sendAnimation").length, 1);
  assert.equal(methods(state, "sendPhoto").length, 1);
  assert.equal(state.counts.collection, 1);
  assert.equal(state.getSession().stage, "completed");
  assert.deepEqual(state.delayCalls, [2000]);
  assert.ok(state.events.indexOf("sendAnimation") < state.events.indexOf("delay"));
  assert.ok(state.events.indexOf("delay") < state.events.indexOf("sendPhoto"));
  assert.ok(state.events.indexOf("sendPhoto") < state.events.indexOf("registerCollection"));
});

test("configura exatamente dois segundos sem fazer o teste esperar em tempo real", () => {
  assert.equal(CARD_REVEAL_DELAY_MS, 2000);
});

test("escolha da estante não utiliza o delay da revelação", async () => {
  const state = harness();
  await state.handler({ ...query("select-shelf"), data: "darts:play:7" }, { updateId: 99 });
  assert.deepEqual(state.delayCalls, []);
  assert.equal(methods(state, "sendPhoto").length, 0);
});

test("callback antigo de grupo é invalidado antes de criar usuário ou produzir efeitos", async () => {
  const calls = [];
  const counts = { user: 0, consume: 0, collection: 0 };
  sessions.saveDartGameSession(-100, 1, {
    stage: "shelf_selected",
    franchiseIds: [7],
    franchiseId: 7,
  });
  const handler = createDartGameCallbackHandler({
    telegramRequest: async (method, body) => calls.push({ method, body }),
    getOrCreateUser: async () => { counts.user += 1; return { id: 1 }; },
    consumeDart: async () => { counts.consume += 1; },
    registerObtainedCharacter: async () => { counts.collection += 1; },
  });

  await handler({
    ...query("old-group-callback"),
    message: { message_id: 55, chat: { id: -100, type: "supergroup" } },
  });

  assert.deepEqual(counts, { user: 0, consume: 0, collection: 0 });
  assert.equal(sessions.getDartGameSession(-100, 1), null);
  assert.equal(calls.some(({ method }) => method === "sendAnimation" || method === "sendPhoto"), false);
  assert.ok(calls.some(({ method, body }) =>
    method === "answerCallbackQuery" && body.text === "O acervo agora funciona somente no privado."));
  assert.ok(calls.some(({ method, body }) =>
    method === "editMessageReplyMarkup" && body.reply_markup.inline_keyboard.length === 0));
});

test("mesmo callback entregue tres vezes nao repete efeitos", async () => {
  const state = harness();
  await state.handler(query(), { updateId: 101 });
  await state.handler(query(), { updateId: 101 });
  await state.handler(query(), { updateId: 101 });
  assert.equal(state.counts.consume, 1);
  assert.equal(methods(state, "sendAnimation").length, 1);
  assert.equal(methods(state, "sendPhoto").length, 1);
  assert.equal(state.counts.collection, 1);
});

test("dois cliques rapidos avisam que o sorteio esta em andamento", async () => {
  let releaseAnimation;
  const animationWait = new Promise((resolve) => { releaseAnimation = resolve; });
  const state = harness({ delay: () => animationWait });
  const first = state.handler(query("click-1"), { updateId: 102 });
  while (methods(state, "sendAnimation").length === 0) await new Promise((resolve) => setImmediate(resolve));
  await state.handler(query("click-2"), { updateId: 103 });
  const inProgress = methods(state, "answerCallbackQuery")
    .find((call) => call.body.text === "A exploração já está em andamento.");
  assert.ok(inProgress);
  assert.equal(state.counts.consume, 1);
  assert.equal(methods(state, "sendAnimation").length, 1);
  releaseAnimation();
  await first;
});

test("sendPhoto falha depois do alvo, devolve uma vez e retry externo nao repete", async () => {
  const state = harness({ photoError: Object.assign(new Error("Bad Request: wrong file identifier/HTTP URL specified"), { code: 400 }) });
  let attempts = 0;
  const update = { update_id: 104, callback_query: query("photo-failure") };
  await processUpdateWithRetry(update, () => true, async (received) => {
    attempts += 1;
    await state.handler(received.callback_query, { updateId: received.update_id });
    if (attempts < 3) throw new Error("falha posterior simulada");
  });
  assert.equal(attempts, 3);
  assert.equal(methods(state, "sendAnimation").length, 1);
  assert.equal(methods(state, "sendPhoto").length, 1);
  assert.equal(state.counts.refund, 1);
  assert.equal(state.counts.collection, 0);
  assert.equal(methods(state, "sendMessage").length, 1);
  assert.equal(state.getSession().stage, "failed");
});

test("falha cosmética de sendAnimation ainda revela e registra a carta", async () => {
  const state = harness({ diceError: Object.assign(new Error("animation unavailable"), { code: 500 }) });
  await state.handler(query("dice-failure"), { updateId: 105 });
  assert.equal(methods(state, "sendAnimation").length, 1);
  assert.equal(methods(state, "sendPhoto").length, 1);
  assert.equal(state.counts.consume, 1);
  assert.equal(state.counts.refund, 0);
  assert.equal(state.counts.collection, 1);
  assert.deepEqual(state.delayCalls, [2000]);
  assert.ok(state.events.indexOf("sendAnimation") < state.events.indexOf("delay"));
  assert.ok(state.events.indexOf("delay") < state.events.indexOf("sendPhoto"));
});

test("a transação de consumo terminou antes do delay", async () => {
  let transactionOpen = false;
  const state = harness({
    consumeDart: async () => {
      transactionOpen = true;
      transactionOpen = false;
      return { consumed: true, remainingDarts: 2 };
    },
    delay: async () => assert.equal(transactionOpen, false),
  });
  await state.handler(query("transaction-closed"), { updateId: 107 });
});

test("falha da colecao depois da foto nao devolve nem repete", async () => {
  const state = harness({ collectionError: new Error("relation dart_collection_entries does not exist") });
  await state.handler(query("collection-failure"), { updateId: 106 });
  await state.handler(query("collection-failure"), { updateId: 106 });
  assert.equal(methods(state, "sendAnimation").length, 1);
  assert.equal(methods(state, "sendPhoto").length, 1);
  assert.equal(state.counts.consume, 1);
  assert.equal(state.counts.refund, 0);
  assert.equal(state.counts.collection, 1);
  assert.equal(methods(state, "sendMessage").length, 1);
});

test("identifica erros de file_id invalido sem expor o identificador", () => {
  assert.equal(isInvalidTelegramFile(new Error("Bad Request: wrong file identifier/HTTP URL specified")), true);
  assert.equal(isInvalidTelegramFile(new Error("failed to get HTTP URL content")), true);
});

test("dispatcher possui um unico caminho para o handler de dardos", () => {
  const root = path.join(__dirname, "..");
  const callback = fs.readFileSync(path.join(root, "src/handlers/callbackQueryHandler.js"), "utf8");
  const index = fs.readFileSync(path.join(root, "src/index.js"), "utf8");
  assert.equal((callback.match(/handleDartGameCallback\(/g) || []).length, 1);
  assert.doesNotMatch(index, /handleDartGameCallback|handleCallbackQuery/);
});

test("deploy e bootstrap concluem migrations antes do polling", () => {
  const root = path.join(__dirname, "..");
  const packageJson = require(path.join(root, "package.json"));
  const index = fs.readFileSync(path.join(root, "src/index.js"), "utf8");
  assert.equal(packageJson.scripts["render:start"], "npm run db:migrate && npm start");
  assert.ok(index.indexOf("await ensureDatabaseIsMigrated()") < index.indexOf("await runPolling"));
  assert.match(index, /dart_collection_entries/);
});
