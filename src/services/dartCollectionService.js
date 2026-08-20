const { QueryTypes } = require("sequelize");
const {
  sequelize, Franchise, DartCharacter, DartCollectionEntry,
} = require("../database/models");

async function registerObtainedCharacter({ userId, characterId, obtainedAt = new Date() }) {
  const rows = await sequelize.query(
    `INSERT INTO dart_collection_entries
       ("userId", "characterId", quantity, "firstObtainedAt", "lastObtainedAt", "createdAt", "updatedAt")
     VALUES (:userId, :characterId, 1, :obtainedAt, :obtainedAt, :obtainedAt, :obtainedAt)
     ON CONFLICT ("userId", "characterId") DO UPDATE
       SET quantity = dart_collection_entries.quantity + 1,
           "lastObtainedAt" = EXCLUDED."lastObtainedAt",
           "updatedAt" = EXCLUDED."updatedAt"
     RETURNING *`,
    { replacements: { userId, characterId, obtainedAt }, type: QueryTypes.SELECT },
  );
  return rows[0];
}

function entryForUser(character, userId) {
  return (character.collectionEntries || []).find((entry) => Number(entry.userId) === Number(userId));
}

async function getCollectionSummary(userId) {
  const franchises = await Franchise.findAll({
    where: { active: true },
    attributes: ["id", "name"],
    include: [{
      model: DartCharacter,
      as: "characters",
      where: { active: true },
      required: true,
      attributes: ["id"],
      include: [{
        model: DartCollectionEntry,
        as: "collectionEntries",
        where: { userId },
        required: false,
        attributes: ["userId", "quantity"],
      }],
    }],
    order: [["name", "ASC"], [{ model: DartCharacter, as: "characters" }, "id", "ASC"]],
  });

  const items = franchises.map((franchise) => {
    const characters = franchise.characters || [];
    return {
      id: franchise.id,
      name: franchise.name,
      obtained: characters.reduce((count, character) => count + (entryForUser(character, userId) ? 1 : 0), 0),
      total: characters.length,
    };
  });
  return {
    franchises: items,
    obtained: items.reduce((sum, item) => sum + item.obtained, 0),
    total: items.reduce((sum, item) => sum + item.total, 0),
  };
}

async function getFranchiseCollection(userId, franchiseId) {
  const franchise = await Franchise.findOne({ where: { id: franchiseId, active: true }, attributes: ["id", "name"] });
  if (!franchise) return null;

  const characters = await DartCharacter.findAll({
    where: { franchiseId },
    attributes: ["id", "name", "rarity", "active"],
    include: [{
      model: DartCollectionEntry,
      as: "collectionEntries",
      where: { userId },
      required: false,
      attributes: ["userId", "quantity", "firstObtainedAt", "lastObtainedAt"],
    }],
    order: [["name", "ASC"]],
  });
  const active = characters.filter((character) => character.active);
  const obtained = active.flatMap((character) => {
    const entry = entryForUser(character, userId);
    return entry ? [{ id: character.id, name: character.name, rarity: character.rarity, quantity: entry.quantity }] : [];
  });
  const archived = characters.flatMap((character) => {
    const entry = entryForUser(character, userId);
    return !character.active && entry
      ? [{ id: character.id, name: character.name, rarity: character.rarity, quantity: entry.quantity }]
      : [];
  });
  return {
    franchise: { id: franchise.id, name: franchise.name },
    obtained,
    archived,
    obtainedCount: obtained.length,
    total: active.length,
  };
}

module.exports = {
  registerObtainedCharacter,
  getCollectionSummary,
  getFranchiseCollection,
  entryForUser,
};
