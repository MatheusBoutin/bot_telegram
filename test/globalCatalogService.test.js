const test = require("node:test");
const assert = require("node:assert/strict");
const { Franchise } = require("../src/database/models");
const { listFranchises, findActiveFranchise } = require("../src/services/dartCatalogService");

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
