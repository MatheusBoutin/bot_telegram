const test = require("node:test");
const assert = require("node:assert/strict");
const game = require("../src/services/dartGameSessionService");
const catalog = require("../src/services/dartCatalogSessionService");

test("sessão administrativa é consumida uma única vez", () => {
  catalog.saveCatalogSession(901, 902, { stage: "archive_card", characterId: 77 });
  assert.equal(catalog.takeCatalogSession(901, 902, "archive_card").characterId, 77);
  assert.equal(catalog.takeCatalogSession(901, 902, "archive_card"), null);
  assert.equal(catalog.getCatalogSession(901, 902), null);
});

test("sessões dos dardos são isoladas por chatId:userId", () => {
  game.saveDartGameSession(10, 5, { marker: "privado" });
  game.saveDartGameSession(20, 5, { marker: "grupo" });
  assert.equal(game.getDartGameSession(10, 5).marker, "privado");
  assert.equal(game.getDartGameSession(20, 5).marker, "grupo");
  assert.equal(game.getSessionKey(10, 5), "10:5");
});

test("sessões administrativas são isoladas por chatId:userId", () => {
  catalog.saveCatalogSession(10, 5, { marker: "a" });
  catalog.saveCatalogSession(20, 5, { marker: "b" });
  assert.equal(catalog.getCatalogSession(10, 5).marker, "a");
  assert.equal(catalog.getCatalogSession(20, 5).marker, "b");
});
