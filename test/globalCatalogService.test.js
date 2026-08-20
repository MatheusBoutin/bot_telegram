const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Franchise } = require("../src/database/models");
const { listFranchises, findActiveFranchise } = require("../src/services/dartCatalogService");

test("catálogo global não aplica filtro clubId", { concurrency: false }, async () => {
  const oldAll = Franchise.findAll; const oldOne = Franchise.findOne;
  try {
    Franchise.findAll = async (options) => { assert.deepEqual(options.where, { active: true }); return []; };
    Franchise.findOne = async (options) => { assert.deepEqual(options.where, { id: 9, active: true }); return null; };
    await listFranchises({ activeOnly: true }); await findActiveFranchise(9);
  } finally { Franchise.findAll = oldAll; Franchise.findOne = oldOne; }
});

test("arquivamento de catálogo é lógico, transacional e preserva coleções", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/services/dartCatalogService.js"), "utf8");
  assert.match(source, /sequelize\.transaction/);
  assert.match(source, /active: false/);
  assert.match(source, /DartCharacter\.update/);
  assert.doesNotMatch(source, /\.destroy\(/);
  assert.doesNotMatch(source, /DartCollectionEntry/);
});
