const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createDartGameCallbackHandler, isInvalidTelegramFile } = require("../src/handlers/dartGameCallbackHandler");
const { processUpdateWithRetry } = require("../src/services/pollingService");

const query = (id = "callback-1") => ({
  id,
  data: "darts:play:7",
  from: { id: 99, first_name: "Leitora" },
  message: { message_id: 55, chat: { id: 10, type: "private" } },
});

function harness(options = {}) {
  let session = { stage: "ready", franchiseIds: [7] };
  const processed = new Set();
  const calls = [];
  const counts = { consume: 0, refund: 0, collection: 0 };
  const photoError = options.photoError;
  const diceError = options.diceError;
  const collectionError = options.collectionError;
  const telegramRequest = async (method, body) => {
    calls.push({ method, body });
    if (method === "sendDice" && diceError) throw diceError;
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
    consumeDart: async () => { counts.consume += 1; return { consumed: true, remainingDarts: 2 }; },
    refundDart: async () => { counts.refund += 1; },
    drawCharacter: async () => ({
      id: 8, name: "Heroína", rarity: "rare", description: "Descrição", imageFileId: "telegram-file-id",
    }),
    registerObtainedCharacter: async () => {
      counts.collection += 1;
      if (collectionError) throw collectionError;
    },
    wait: options.wait || (async () => {}),
    animationDelayMs: 0,
  });
  return { handler, calls, counts, getSession: () => session };
}

const methods = (state, method) => state.calls.filter((call) => call.method === method);

test("sorteio normal consome, anima, revela e registra uma vez", async () => {
  const state = harness();
  await state.handler(query(), { updateId: 100 });
  assert.equal(state.counts.consume, 1);
  assert.equal(methods(state, "sendDice").length, 1);
  assert.equal(methods(state, "sendPhoto").length, 1);
  assert.equal(state.counts.collection, 1);
  assert.equal(state.getSession().stage, "completed");
});

test("mesmo callback entregue tres vezes nao repete efeitos", async () => {
  const state = harness();
  await state.handler(query(), { updateId: 101 });
  await state.handler(query(), { updateId: 101 });
  await state.handler(query(), { updateId: 101 });
  assert.equal(state.counts.consume, 1);
  assert.equal(methods(state, "sendDice").length, 1);
  assert.equal(methods(state, "sendPhoto").length, 1);
  assert.equal(state.counts.collection, 1);
});

test("dois cliques rapidos avisam que o sorteio esta em andamento", async () => {
  let releaseAnimation;
  const animationWait = new Promise((resolve) => { releaseAnimation = resolve; });
  const state = harness({ wait: () => animationWait });
  const first = state.handler(query("click-1"), { updateId: 102 });
  while (methods(state, "sendDice").length === 0) await new Promise((resolve) => setImmediate(resolve));
  await state.handler(query("click-2"), { updateId: 103 });
  const inProgress = methods(state, "answerCallbackQuery")
    .find((call) => call.body.text === "O sorteio já está em andamento.");
  assert.ok(inProgress);
  assert.equal(state.counts.consume, 1);
  assert.equal(methods(state, "sendDice").length, 1);
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
  assert.equal(methods(state, "sendDice").length, 1);
  assert.equal(methods(state, "sendPhoto").length, 1);
  assert.equal(state.counts.refund, 1);
  assert.equal(state.counts.collection, 0);
  assert.equal(methods(state, "sendMessage").length, 1);
  assert.equal(state.getSession().stage, "failed");
});

test("falha cosmetica de sendDice ainda revela e registra a carta", async () => {
  const state = harness({ diceError: Object.assign(new Error("animation unavailable"), { code: 500 }) });
  await state.handler(query("dice-failure"), { updateId: 105 });
  assert.equal(methods(state, "sendDice").length, 1);
  assert.equal(methods(state, "sendPhoto").length, 1);
  assert.equal(state.counts.consume, 1);
  assert.equal(state.counts.refund, 0);
  assert.equal(state.counts.collection, 1);
});

test("falha da colecao depois da foto nao devolve nem repete", async () => {
  const state = harness({ collectionError: new Error("relation dart_collection_entries does not exist") });
  await state.handler(query("collection-failure"), { updateId: 106 });
  await state.handler(query("collection-failure"), { updateId: 106 });
  assert.equal(methods(state, "sendDice").length, 1);
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
