const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const models = require("../src/database/models");
const service = require("../src/services/dartCollectionService");
const {
  buildSummaryView, buildFranchiseView, SUMMARY_PAGE_SIZE, DETAIL_PAGE_SIZE,
} = require("../src/commands/collectionCommand");

const source = (relativePath) => fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

function collection(overrides = {}) {
  return {
    franchise: { id: 4, name: "Quarta Asa" },
    obtained: [], archived: [], obtainedCount: 0, total: 5,
    ...overrides,
  };
}

test("primeira carta cria quantidade 1 com upsert atômico", { concurrency: false }, async () => {
  const original = models.sequelize.query;
  let sql;
  models.sequelize.query = async (query) => { sql = query; return [{ quantity: 1 }]; };
  try {
    const entry = await service.registerObtainedCharacter({ userId: 1, characterId: 2 });
    assert.equal(entry.quantity, 1);
    assert.match(sql, /ON CONFLICT \("userId", "characterId"\) DO UPDATE/);
    assert.match(sql, /quantity = dart_collection_entries\.quantity \+ 1/);
  } finally { models.sequelize.query = original; }
});

test("carta repetida exibe ×2 sem aumentar personagens únicos", () => {
  const view = buildFranchiseView(collection({
    obtained: [{ id: 1, name: "Violet Sorrengail", rarity: "rare", quantity: 2 }],
    obtainedCount: 1,
  }), 9);
  assert.match(view.text, /Coleção: 1\/5/);
  assert.match(view.text, /Violet Sorrengail ×2/);
});

test("duas cartas diferentes produzem progresso 2/N e franquias não se misturam", () => {
  const view = buildSummaryView({
    franchises: [
      { id: 1, name: "A", obtained: 2, total: 5 },
      { id: 2, name: "B", obtained: 1, total: 8 },
    ],
    obtained: 3, total: 13,
  }, 7);
  assert.match(view.text, /A — 2\/5/);
  assert.match(view.text, /B — 1\/8/);
  assert.match(view.text, /Total: 3\/13/);
});

test("quantidade 1 não é exibida e raridade usa o padrão atual", () => {
  const view = buildFranchiseView(collection({
    obtained: [{ id: 1, name: "Xaden", rarity: "legendary", quantity: 1 }], obtainedCount: 1,
  }), 9);
  assert.doesNotMatch(view.text, /×1/);
  assert.match(view.text, /Xaden.*Lendário/);
});

test("nomes especiais são escapados para HTML", () => {
  const view = buildFranchiseView(collection({
    franchise: { id: 4, name: "A&B <Saga>" },
    obtained: [{ id: 1, name: "<Violet & Xaden>", rarity: "rare", quantity: 1 }], obtainedCount: 1,
  }), 9);
  assert.match(view.text, /A&amp;B &lt;Saga&gt;/);
  assert.match(view.text, /&lt;Violet &amp; Xaden&gt;/);
});

test("coleção vazia mostra 0/N e orientação; catálogo vazio tem mensagem própria", () => {
  const populated = buildSummaryView({ franchises: [{ id: 1, name: "Saga", obtained: 0, total: 3 }], obtained: 0, total: 3 }, 1);
  assert.match(populated.text, /Saga — 0\/3/);
  assert.match(populated.text, /Use \/acervo/);
  const empty = buildSummaryView({ franchises: [], obtained: 0, total: 0 }, 1);
  assert.equal(empty.text, "O catálogo ainda não possui cartas disponíveis.");
});

test("paginação limita páginas, navega e oferece voltar", () => {
  const franchises = Array.from({ length: SUMMARY_PAGE_SIZE + 1 }, (_, index) => ({ id: index + 1, name: `F${index}`, obtained: 0, total: 1 }));
  const summary = buildSummaryView({ franchises, obtained: 0, total: franchises.length }, 3, 1);
  assert.match(summary.text, /Página 2\/2/);
  assert.match(JSON.stringify(summary.reply_markup), /col:s:3:0/);
  const cards = Array.from({ length: DETAIL_PAGE_SIZE + 1 }, (_, index) => ({ id: index, name: `C${index}`, rarity: "common", quantity: 1 }));
  const detail = buildFranchiseView(collection({ obtained: cards, obtainedCount: cards.length, total: cards.length }), 3, 99);
  assert.match(detail.text, /Página 2\/2/);
  assert.match(JSON.stringify(detail.reply_markup), /⬅️ Voltar/);
});

test("callbacks são compactos, numéricos e vinculados ao dono", () => {
  const view = buildSummaryView({ franchises: [{ id: 456, name: "Nome muito longo".repeat(5), obtained: 0, total: 1 }], obtained: 0, total: 1 }, 123);
  const data = view.reply_markup.inline_keyboard[0][0].callback_data;
  assert.equal(data, "col:f:123:456:0");
  assert.ok(Buffer.byteLength(data) <= 64);
  const handler = source("src/handlers/dartCollectionCallbackHandler.js");
  assert.match(handler, /user\.id !== ownerId/);
  assert.match(handler, /Esta coleção pertence a outro usuário\./);
  assert.match(handler, /answerCallbackQuery/);
});

test("comando global roda antes de Club e ClubMember, inclusive no privado", () => {
  const handler = source("src/handlers/messageHandler.js");
  const route = handler.indexOf('commandName === "/colecao"');
  assert.ok(route > handler.indexOf("getOrCreateUser(message)"));
  assert.ok(route < handler.indexOf("getOrCreateClub(message)"));
  assert.ok(route < handler.indexOf("getOrCreateClubMember(user, club)"));
});

test("model e migration são globais, únicos e protegem o histórico", () => {
  const model = source("src/database/models/DartCollectionEntry.js");
  const migration = source("src/database/migrations/20260820000100-create-dart-collection-entries.js");
  assert.doesNotMatch(model + migration, /clubId/);
  assert.match(migration, /\["userId", "characterId"\]/);
  assert.match(migration, /onDelete: "RESTRICT"/);
  assert.match(migration, /firstObtainedAt/);
  assert.match(migration, /lastObtainedAt/);
});

test("envio bem-sucedido registra depois da foto; falha devolve antes de qualquer registro", () => {
  const handler = source("src/handlers/dartGameCallbackHandler.js");
  const send = handler.indexOf('await call("sendPhoto"');
  const register = handler.indexOf("await deps.registerObtainedCharacter", send);
  const catchAfterSend = handler.indexOf("await refundOnce()", send);
  assert.ok(send >= 0 && send < register);
  assert.ok(send < catchAfterSend && catchAfterSend < register);
});

test("denominador e únicos usam exatamente personagens e franquias ativos", () => {
  const collectionService = source("src/services/dartCollectionService.js");
  assert.match(collectionService, /Franchise\.findAll\([\s\S]*where: \{ active: true \}/);
  assert.match(collectionService, /model: DartCharacter,[\s\S]*where: \{ active: true \}/);
  assert.match(collectionService, /characters\.length/);
  assert.match(collectionService, /entryForUser\(character, userId\) \? 1 : 0/);
});

test("usuários diferentes são filtrados pelo userId global", () => {
  const collectionService = source("src/services/dartCollectionService.js");
  assert.match(collectionService, /where: \{ userId \}/);
  assert.doesNotMatch(collectionService, /Club|ClubMember|clubId/);
});

test("duas aquisições simultâneas dependem da restrição única e incremento no banco", async () => {
  const migration = source("src/database/migrations/20260820000100-create-dart-collection-entries.js");
  const collectionService = source("src/services/dartCollectionService.js");
  assert.match(migration, /unique: true/);
  assert.match(collectionService, /ON CONFLICT/);
  assert.match(collectionService, /quantity \+ 1/);
});

test("não há backfill sem histórico confiável nem cartas inventadas", () => {
  const migration = source("src/database/migrations/20260820000100-create-dart-collection-entries.js");
  assert.doesNotMatch(migration, /INSERT INTO|SELECT .*dart/i);
});

test("mensagens paginadas permanecem abaixo do limite do Telegram", () => {
  const cards = Array.from({ length: 100 }, (_, index) => ({ id: index, name: "<&>".repeat(30), rarity: "legendary", quantity: 999 }));
  const view = buildFranchiseView(collection({ obtained: cards, obtainedCount: 100, total: 100 }), 1, 0);
  assert.ok(view.text.length < 4096);
});
