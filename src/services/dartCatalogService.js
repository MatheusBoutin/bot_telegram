const { Franchise, DartCharacter } = require("../database/models");

async function createFranchise({ club, adminUser, parsedFranchise }) {
  const [franchise, created] = await Franchise.findOrCreate({
    where: {
      clubId: club.id,
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

async function listFranchises(club, { activeOnly = false } = {}) {
  const where = {
    clubId: club.id,
  };

  if (activeOnly) {
    where.active = true;
  }

  return Franchise.findAll({
    where,
    order: [["name", "ASC"]],
  });
}

async function findActiveFranchise(club, franchiseId) {
  return Franchise.findOne({
    where: {
      id: franchiseId,
      clubId: club.id,
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

async function listCharacters(franchise, { activeOnly = false } = {}) {
  const where = {
    franchiseId: franchise.id,
  };

  if (activeOnly) {
    where.active = true;
  }

  return DartCharacter.findAll({
    where,

    order: [
      ["rarity", "ASC"],
      ["name", "ASC"],
    ],

    limit: 20,
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
};
