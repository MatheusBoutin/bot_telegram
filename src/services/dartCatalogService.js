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
    order: [["name", "ASC"]],
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

module.exports = {
  createFranchise,
  listFranchises,
  findActiveFranchise,
  countCharacters,
  listCharacters,
  createDartCharacter,
  findCharacterById,
  findFranchiseById,
  archiveCharacter,
  archiveFranchise,
};
