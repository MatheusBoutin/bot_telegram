const test = require("node:test");
const assert = require("node:assert/strict");
const { DartCharacter } = require("../src/database/models");
const {
  createDartCharacter,
  archiveCharacter,
  listActiveCatalogCharacters,
} = require("../src/services/dartCatalogService");
const { drawCharacter } = require("../src/services/dartGameService");
const migration = require("../src/database/migrations/20260828000000-allow-recreating-archived-dart-characters");

const franchise = { id: 7 };
const adminUser = { id: 11 };
const characterData = {
  name: "  Éowyn  ",
  normalizedName: "eowyn",
  description: "Escudeira de Rohan.",
  rarity: "rare",
  imageFileId: "photo-new",
  imageUniqueId: "unique-new",
};

test("carta arquivada não impede novo cadastro e recebe novo ID", { concurrency: false }, async () => {
  const oldFindOne = DartCharacter.findOne;
  const oldCreate = DartCharacter.create;
  try {
    DartCharacter.findOne = async (options) => {
      assert.deepEqual(options.where, { franchiseId: 7, normalizedName: "eowyn", active: true });
      return null;
    };
    DartCharacter.create = async (values) => ({ id: 202, ...values });

    const created = await createDartCharacter({ franchise, adminUser, characterData });
    assert.equal(created.id, 202);
    assert.equal(created.active, true);
    assert.equal(created.normalizedName, "eowyn");
  } finally {
    DartCharacter.findOne = oldFindOne;
    DartCharacter.create = oldCreate;
  }
});

test("carta ativa com mesmo nome normalizado e franquia continua bloqueada", { concurrency: false }, async () => {
  const oldFindOne = DartCharacter.findOne;
  const oldCreate = DartCharacter.create;
  try {
    DartCharacter.findOne = async () => ({ id: 101, active: true });
    DartCharacter.create = async () => assert.fail("não deve inserir a duplicata ativa");

    await assert.rejects(
      createDartCharacter({ franchise, adminUser, characterData }),
      { name: "SequelizeUniqueConstraintError" },
    );
  } finally {
    DartCharacter.findOne = oldFindOne;
    DartCharacter.create = oldCreate;
  }
});

test("arquivamento preserva a carta antiga e não altera coleções", { concurrency: false }, async () => {
  const oldFindByPk = DartCharacter.findByPk;
  const oldTransaction = require("../src/database/models").sequelize.transaction;
  const oldCard = {
    id: 101,
    active: true,
    collectionEntries: [{ userId: 55, characterId: 101, quantity: 2 }],
    async update(values) { Object.assign(this, values); },
  };
  try {
    require("../src/database/models").sequelize.transaction = async (callback) => callback({ LOCK: { UPDATE: "UPDATE" } });
    DartCharacter.findByPk = async () => oldCard;
    const result = await archiveCharacter(101);
    assert.equal(result.changed, true);
    assert.equal(oldCard.id, 101);
    assert.equal(oldCard.active, false);
    assert.deepEqual(oldCard.collectionEntries, [{ userId: 55, characterId: 101, quantity: 2 }]);
  } finally {
    DartCharacter.findByPk = oldFindByPk;
    require("../src/database/models").sequelize.transaction = oldTransaction;
  }
});

test("listagem e sorteio consultam somente a nova carta ativa", { concurrency: false }, async () => {
  const oldFindAll = DartCharacter.findAll;
  const newCard = { id: 202, franchiseId: 7, normalizedName: "eowyn", active: true, rarity: "rare" };
  try {
    DartCharacter.findAll = async (options) => {
      assert.equal(options.where.active, true);
      return [newCard];
    };
    assert.deepEqual(await listActiveCatalogCharacters(), [newCard]);
    assert.equal((await drawCharacter(franchise)).id, 202);
  } finally {
    DartCharacter.findAll = oldFindAll;
  }
});

test("migration mantém unicidade atômica apenas entre cartas ativas", async () => {
  const calls = [];
  const transaction = { id: "migration-transaction" };
  const queryInterface = {
    sequelize: { transaction: async (callback) => callback(transaction) },
    removeIndex: async (...args) => calls.push(["removeIndex", ...args]),
    addIndex: async (...args) => calls.push(["addIndex", ...args]),
  };

  await migration.up(queryInterface);

  assert.equal(calls[0][1], "dart_characters");
  assert.equal(calls[0][2], "dart_characters_franchise_normalized_name_unique");
  assert.deepEqual(calls[1][2], ["franchiseId", "normalizedName"]);
  assert.equal(calls[1][3].unique, true);
  assert.deepEqual(calls[1][3].where, { active: true });
  assert.equal(calls[1][3].transaction, transaction);
});

test("índice parcial do modelo protege cadastros simultâneos", () => {
  const index = DartCharacter.options.indexes.find(
    (candidate) => candidate.name === "dart_characters_franchise_active_normalized_name_unique",
  );
  assert.equal(index.unique, true);
  assert.deepEqual(index.fields, ["franchiseId", "normalizedName"]);
  assert.deepEqual(index.where, { active: true });
});

test("duas solicitações simultâneas não criam duas cartas ativas iguais", { concurrency: false }, async () => {
  const oldFindOne = DartCharacter.findOne;
  const oldCreate = DartCharacter.create;
  let activeInsertExists = false;
  try {
    // As duas pré-verificações passam; a decisão final precisa continuar sendo do índice único.
    DartCharacter.findOne = async () => null;
    DartCharacter.create = async (values) => {
      if (activeInsertExists) {
        const error = new Error("duplicate key value violates unique constraint");
        error.name = "SequelizeUniqueConstraintError";
        throw error;
      }
      activeInsertExists = true;
      return { id: 202, ...values };
    };

    const results = await Promise.allSettled([
      createDartCharacter({ franchise, adminUser, characterData }),
      createDartCharacter({ franchise, adminUser, characterData }),
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    assert.equal(results.find((result) => result.status === "rejected").reason.name, "SequelizeUniqueConstraintError");
  } finally {
    DartCharacter.findOne = oldFindOne;
    DartCharacter.create = oldCreate;
  }
});
