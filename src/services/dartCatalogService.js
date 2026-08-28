const { UniqueConstraintError, Op } = require("sequelize");
const { sequelize, Franchise, DartCharacter } = require("../database/models");

async function createFranchise({ adminUser, parsedFranchise }) {
  const [franchise, created] = await Franchise.findOrCreate({
    where: {
      normalizedName: parsedFranchise.normalizedName,
    },

    defaults: {
      name: parsedFranchise.name,
      active: true,
      createdByUserId: adminUser.id,
    },
  });

  return {
    franchise,
    created,
  };
}

async function findCharacterById(id) {
  return DartCharacter.findByPk(id, { include: [{ model: Franchise, as: "franchise", required: true }] });
}

async function findFranchiseById(id) { return Franchise.findByPk(id); }

async function archiveCharacter(id) {
  return sequelize.transaction(async (transaction) => {
    const character = await DartCharacter.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!character) return null;
    if (!character.active) return { character, changed: false };
    await character.update({ active: false }, { transaction });
    return { character, changed: true };
  });
}

async function archiveFranchise(id) {
  return sequelize.transaction(async (transaction) => {
    const franchise = await Franchise.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!franchise) return null;
    if (!franchise.active) return { franchise, changed: false, characterCount: 0 };
    const characterCount = await DartCharacter.count({ where: { franchiseId: id, active: true }, transaction });
    await franchise.update({ active: false }, { transaction });
    await DartCharacter.update({ active: false }, { where: { franchiseId: id, active: true }, transaction });
    return { franchise, changed: true, characterCount };
  });
}

async function listFranchises({ activeOnly = false } = {}) {
  const where = {};

  if (activeOnly) {
    where.active = true;
  }

  return Franchise.findAll({
    where,
    order: [
      ["createdAt", "ASC"],
      ["id", "ASC"],
    ],
  });
}

async function listActiveCatalogCharacters() {
  return DartCharacter.findAll({
    where: { active: true },
    include: [{ model: Franchise, as: "franchise", required: true, where: { active: true } }],
    order: [
      ["createdAt", "ASC"],
      ["id", "ASC"],
    ],
  });
}

async function findActiveFranchise(franchiseId) {
  return Franchise.findOne({
    where: {
      id: franchiseId,
      active: true,
    },
  });
}

async function countCharacters(franchiseId) {
  return DartCharacter.count({
    where: {
      franchiseId,
      active: true,
    },
  });
}

async function listCharacters(franchise, { active = true } = {}) {
  const where = {
    franchiseId: franchise.id,
    active,
  };

  return DartCharacter.findAll({
    where,

    order: [
      ["rarity", "ASC"],
      ["name", "ASC"],
    ],

  });
}

async function createDartCharacter({ franchise, adminUser, characterData }) {
  const duplicate = await DartCharacter.findOne({
    where: {
      franchiseId: franchise.id,
      normalizedName: characterData.normalizedName,
      active: true,
    },
  });

  if (duplicate) {
    throw new UniqueConstraintError({
      message: "An active character with this normalized name already exists in the franchise.",
      fields: {
        franchiseId: franchise.id,
        normalizedName: characterData.normalizedName,
      },
    });
  }

  return DartCharacter.create({
    franchiseId: franchise.id,
    name: characterData.name,
    normalizedName: characterData.normalizedName,
    description: characterData.description,
    rarity: characterData.rarity,
    imageFileId: characterData.imageFileId,
    imageUniqueId: characterData.imageUniqueId,
    active: true,
    createdByUserId: adminUser.id,
  });
}

async function updateDartCharacter({ characterId, characterData }) {
  if (!characterData || !characterData.name?.trim() || !characterData.description?.trim() || !characterData.normalizedName || !characterData.imageFileId || !["common", "uncommon", "rare", "epic", "legendary"].includes(characterData.rarity)) {
    const error = new Error("Invalid character data");
    error.name = "ValidationError";
    throw error;
  }
  return sequelize.transaction(async (transaction) => {
    const character = await DartCharacter.findByPk(characterId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!character || !character.active) return null;
    const duplicate = await DartCharacter.findOne({
      where: { franchiseId: character.franchiseId, normalizedName: characterData.normalizedName, active: true, id: { [Op.ne]: character.id } },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (duplicate) throw new UniqueConstraintError({ message: "An active character with this normalized name already exists in the franchise." });
    await character.update({ name: characterData.name, normalizedName: characterData.normalizedName, description: characterData.description, imageFileId: characterData.imageFileId, imageUniqueId: characterData.imageUniqueId }, { transaction });
    return character;
  });
}

module.exports = {
  createFranchise,
  listFranchises,
  findActiveFranchise,
  countCharacters,
  listCharacters,
  listActiveCatalogCharacters,
  createDartCharacter,
  findCharacterById,
  findFranchiseById,
  archiveCharacter,
  archiveFranchise,
  updateDartCharacter,
};
