const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { formatCharacterList, formatFranchiseList, resolvePublicItem } = require("../src/commands/dartCatalogCommand");

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
