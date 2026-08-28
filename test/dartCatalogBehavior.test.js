const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { formatCharacterList, formatFranchiseList, resolvePublicItem } = require("../src/commands/dartCatalogCommand");
const { hasDraftChanges } = require("../src/handlers/dartCatalogCallbackHandler");

const read = (relative) => fs.readFileSync(path.join(__dirname, "..", relative), "utf8");

test("/cartas exibe numeração pública contínua sem IDs ou estados internos", () => {
  const cards = [
    { id: 5, name: "Violet Sorrengail", rarity: "legendary", franchise: { name: "Quarta Asa" } },
    { id: 19, name: "Xaden Riorson", rarity: "legendary", franchise: { name: "Quarta Asa" } },
  ];
  const text = formatCharacterList(cards);
  assert.equal(text, "1 — Violet Sorrengail — Quarta Asa — Lendária\n2 — Xaden Riorson — Quarta Asa — Lendária");
  assert.doesNotMatch(text, /ID|ativa|arquivada/i);
  assert.doesNotMatch(text, /5|19/);
});

test("remoção da posição 2 recalcula a sequência sem alterar IDs reais", () => {
  const cards = [
    { id: 11, name: "Violet", rarity: "common", franchise: { name: "A" } },
    { id: 42, name: "Rhiannon", rarity: "common", franchise: { name: "A" } },
    { id: 88, name: "Xaden", rarity: "common", franchise: { name: "A" } },
  ];
  assert.equal(resolvePublicItem(cards, 2).id, 42);
  const remaining = [cards[0], cards[2]];
  assert.match(formatCharacterList(remaining), /^1 — Violet[^\n]+\n2 — Xaden/);
  assert.deepEqual(remaining.map(({ id }) => id), [11, 88]);
});

test("/franquias usa sequência contínua e singular/plural sem estado interno", () => {
  const franchises = [{ id: 7, name: "Quarta Asa" }, { id: 31, name: "Eventos e gincanas" }, { id: 90, name: "Literary" }];
  const text = formatFranchiseList(franchises, [1, 0, 2]);
  assert.equal(text, "1 — Quarta Asa — 1 carta\n2 — Eventos e gincanas — 0 cartas\n3 — Literary — 2 cartas");
  assert.equal(resolvePublicItem(franchises, 2).id, 31);
  assert.doesNotMatch(text, /ID|ativa|arquivada/i);
});

test("listagens e exclusões usam apenas consultas públicas ativas", () => {
  const command = read("src/commands/dartCatalogCommand.js");
  assert.match(command, /listActiveCatalogCharacters\(\)/);
  assert.match(command, /listFranchises\(\{ activeOnly: true \}\)/);
  assert.match(command, /Nenhuma carta cadastrada\./);
  assert.match(command, /Nenhuma franquia cadastrada\./);
  assert.doesNotMatch(command, /cartas.*arquivadas/iu);
  assert.match(command, /characterId: card\.id/);
  assert.match(command, /franchiseId: franchise\.id/);
});

test("callback usa o ID real consumido da sessão, remove botões e é idempotente", () => {
  const callback = read("src/handlers/dartCatalogCallbackHandler.js");
  assert.match(callback, /archiveCharacter\(session\.characterId\)/);
  assert.match(callback, /archiveFranchise\(session\.franchiseId\)/);
  assert.match(callback, /takeCatalogSession/);
  assert.match(callback, /Esta exclusão já foi processada\./);
  assert.match(callback, /reply_markup: \{ inline_keyboard: \[\] \}/);
});

test("arquivamento preserva coleções e nenhuma migration renumera IDs", () => {
  const service = read("src/services/dartCatalogService.js");
  const migrationsPath = path.join(__dirname, "../src/database/migrations");
  const migrations = fs.readdirSync(migrationsPath).map((file) => fs.readFileSync(path.join(migrationsPath, file), "utf8")).join("\n");
  assert.doesNotMatch(service, /\.destroy\(|DartCollectionEntry/);
  assert.doesNotMatch(`${service}\n${migrations}`, /UPDATE\s+dart_characters\s+SET\s+id|ALTER\s+SEQUENCE[^;]+RESTART/is);
});

test("editor reconhece rascunho sem alterações e alterações reais", () => {
  const originalDraft = { name: "Violet", normalizedName: "violet", description: "Texto", rarity: "rare", imageFileId: "photo-1", imageUniqueId: "unique-1" };
  assert.equal(hasDraftChanges({ draft: { ...originalDraft }, originalDraft }), false);
  assert.equal(hasDraftChanges({ draft: { ...originalDraft, description: "Texto novo" }, originalDraft }), true);
});

test("editor envia confirmações visíveis para prévia, sucesso, cancelamento e ausência de mudanças", () => {
  const upload = read("src/services/dartCatalogUploadService.js");
  const callback = read("src/handlers/dartCatalogCallbackHandler.js");
  assert.match(upload, /Nome alterado na prévia\. Clique em Salvar alterações para confirmar\./);
  assert.match(upload, /Texto alterado na prévia\. Clique em Salvar alterações para confirmar\./);
  assert.match(upload, /Imagem alterada na prévia\. Clique em Salvar alterações para confirmar\./);
  assert.match(callback, /✅ Alterações salvas com sucesso!/);
  assert.match(callback, /🗑️ Carta excluída do catálogo com sucesso!/);
  assert.match(callback, /❌ Edição cancelada\. Nenhuma alteração foi salva\./);
  assert.match(callback, /ℹ️ Nenhuma alteração para salvar\./);
  assert.match(callback, /telegramRequest\("sendMessage"/);
});

test("editor conserva o rascunho em falhas e bloqueia callbacks repetidos", () => {
  const callback = read("src/handlers/dartCatalogCallbackHandler.js");
  assert.match(callback, /saveCatalogSession\(chatId, user\.id, \{ \.\.\.session, stage: "editing" \}\)/);
  assert.match(callback, /saveCatalogSession\(chatId, user\.id, \{ \.\.\.session, stage: "editing_delete" \}\)/);
  assert.match(callback, /const EDITING_SAVE_IN_PROGRESS = "editing_saving"/);
  assert.match(callback, /const EDITING_DELETE_IN_PROGRESS = "editing_deleting"/);
  assert.match(callback, /session\.stage === EDITING_SAVE_IN_PROGRESS/);
  assert.match(callback, /session\.stage === EDITING_DELETE_IN_PROGRESS/);
  assert.match(callback, /O rascunho foi mantido/);
});
