const test = require("node:test");
const assert = require("node:assert/strict");
const { Franchise } = require("../src/database/models");
const { listFranchises, findActiveFranchise, deleteFranchise } = require("../src/services/dartCatalogService");

test("catálogo global não aplica filtro clubId", { concurrency: false }, async () => {
  const oldAll = Franchise.findAll;
  const oldOne = Franchise.findOne;
  try {
    Franchise.findAll = async (options) => { assert.deepEqual(options.where, { active: true }); return []; };
    Franchise.findOne = async (options) => { assert.deepEqual(options.where, { id: 9, active: true }); return null; };
    await listFranchises({ activeOnly: true });
    await findActiveFranchise(9);
  } finally { Franchise.findAll = oldAll; Franchise.findOne = oldOne; }
});

test("exclui franquia global e deixa o cascade remover seus personagens", { concurrency: false }, async () => {
  const oldOne = Franchise.findOne;
  const oldCount = require("../src/database/models").DartCharacter.count;
  let destroyed = false;
  try {
    Franchise.findOne = async (options) => {
      assert.deepEqual(options.where, { normalizedName: "senhor dos aneis" });
      return { id: 9, name: "Senhor dos Anéis", destroy: async () => { destroyed = true; } };
    };
    require("../src/database/models").DartCharacter.count = async (options) => {
      assert.deepEqual(options.where, { franchiseId: 9 });
      return 3;
    };

    const result = await deleteFranchise({ normalizedName: "senhor dos aneis" });

    assert.equal(result.characterCount, 3);
    assert.equal(destroyed, true);
  } finally {
    Franchise.findOne = oldOne;
    require("../src/database/models").DartCharacter.count = oldCount;
  }
});

test("não tenta excluir franquia inexistente", { concurrency: false }, async () => {
  const oldOne = Franchise.findOne;
  try {
    Franchise.findOne = async () => null;
    assert.equal(await deleteFranchise({ normalizedName: "inexistente" }), null);
  } finally {
    Franchise.findOne = oldOne;
  }
});
