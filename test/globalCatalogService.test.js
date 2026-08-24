const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Franchise, DartCharacter } = require("../src/database/models");
const { listFranchises, findActiveFranchise, listCharacters, listActiveCatalogCharacters } = require("../src/services/dartCatalogService");

test("catálogo global não aplica filtro clubId", { concurrency: false }, async () => {
  const oldAll = Franchise.findAll; const oldOne = Franchise.findOne;
  try {
    Franchise.findAll = async (options) => { assert.deepEqual(options.where, { active: true }); return []; };
    Franchise.findOne = async (options) => { assert.deepEqual(options.where, { id: 9, active: true }); return null; };
    await listFranchises({ activeOnly: true }); await findActiveFranchise(9);
  } finally { Franchise.findAll = oldAll; Franchise.findOne = oldOne; }
});

test("listagem de cartas sempre aplica explicitamente o estado solicitado", { concurrency: false }, async () => {
  const oldFindAll = DartCharacter.findAll;
  const seen = [];
  try {
    DartCharacter.findAll = async (options) => { seen.push(options.where); return []; };
    await listCharacters({ id: 7 });
    await listCharacters({ id: 7 }, { active: false });
    assert.deepEqual(seen, [
      { franchiseId: 7, active: true },
      { franchiseId: 7, active: false },
    ]);
  } finally {
    DartCharacter.findAll = oldFindAll;
  }
});

test("listagem pública inclui somente cartas de franquias ativas e usa ordem estável", { concurrency: false }, async () => {
  const oldFindAll = DartCharacter.findAll;
  try {
    DartCharacter.findAll = async (options) => {
      assert.deepEqual(options.where, { active: true });
      assert.deepEqual(options.include[0].where, { active: true });
      assert.equal(options.include[0].required, true);
      assert.deepEqual(options.order, [["createdAt", "ASC"], ["id", "ASC"]]);
      return [];
    };
    await listActiveCatalogCharacters();
  } finally {
    DartCharacter.findAll = oldFindAll;
  }
});

test("arquivamento de catálogo é lógico, transacional e preserva coleções", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/services/dartCatalogService.js"), "utf8");
  assert.match(source, /sequelize\.transaction/);
  assert.match(source, /active: false/);
  assert.match(source, /DartCharacter\.update/);
  assert.doesNotMatch(source, /\.destroy\(/);
  assert.doesNotMatch(source, /DartCollectionEntry/);
  assert.doesNotMatch(source, /SET\s+id|RESTART/i);
});
