const { Op } = require("sequelize");

const {
  sequelize,
  ClubMember,
  Franchise,
  DartCharacter,
} = require("../database/models");

const {
  DARTS_PER_DAY,
  DARTS_TIME_ZONE,
  DART_RARITY_WEIGHTS,
} = require("../config/dartGameConfig");

function getDartDay(date = new Date()) {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DARTS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const partsByType = Object.fromEntries(
    dateParts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return (
    `${partsByType.year}-` + `${partsByType.month}-` + `${partsByType.day}`
  );
}

async function refreshDailyDarts(member, date = new Date()) {
  const today = getDartDay(date);

  if (member.dartsRefreshedOn === today) {
    return member;
  }

  await ClubMember.update(
    {
      dartsAvailable: DARTS_PER_DAY,
      dartsRefreshedOn: today,
    },
    {
      where: {
        id: member.id,

        [Op.or]: [
          {
            dartsRefreshedOn: null,
          },
          {
            dartsRefreshedOn: {
              [Op.ne]: today,
            },
          },
        ],
      },
    },
  );

  await member.reload();

  return member;
}

async function consumeDart(member) {
  await refreshDailyDarts(member);

  const [affectedRows] = await ClubMember.update(
    {
      dartsAvailable: sequelize.literal('"dartsAvailable" - 1'),
    },
    {
      where: {
        id: member.id,

        dartsAvailable: {
          [Op.gt]: 0,
        },
      },
    },
  );

  await member.reload();

  return {
    consumed: affectedRows === 1,
    remainingDarts: member.dartsAvailable,
  };
}

async function getPlayableFranchises(club) {
  const franchises = await Franchise.findAll({
    where: {
      clubId: club.id,
      active: true,
    },

    order: [["name", "ASC"]],
  });

  const playableFranchises = await Promise.all(
    franchises.map(async (franchise) => {
      const characterCount = await DartCharacter.count({
        where: {
          franchiseId: franchise.id,
          active: true,
        },
      });

      return {
        franchise,
        characterCount,
      };
    }),
  );

  return playableFranchises.filter(({ characterCount }) => {
    return characterCount > 0;
  });
}

function getCharacterWeight(character) {
  return DART_RARITY_WEIGHTS[character.rarity] || 1;
}

function chooseWeightedCharacter(characters, random = Math.random) {
  if (characters.length === 0) {
    return null;
  }

  const totalWeight = characters.reduce((total, character) => {
    return total + getCharacterWeight(character);
  }, 0);

  let drawnWeight = random() * totalWeight;

  for (const character of characters) {
    drawnWeight -= getCharacterWeight(character);

    if (drawnWeight < 0) {
      return character;
    }
  }

  return characters.at(-1);
}

async function drawCharacter(franchise) {
  const characters = await DartCharacter.findAll({
    where: {
      franchiseId: franchise.id,
      active: true,
    },
  });

  return chooseWeightedCharacter(characters);
}

async function findPlayableFranchise(club, franchiseId) {
  const franchise = await Franchise.findOne({
    where: {
      id: franchiseId,
      clubId: club.id,
      active: true,
    },
  });

  if (!franchise) {
    return null;
  }

  const characterCount = await DartCharacter.count({
    where: {
      franchiseId: franchise.id,
      active: true,
    },
  });

  return characterCount > 0 ? franchise : null;
}

module.exports = {
  getDartDay,
  refreshDailyDarts,
  consumeDart,
  getPlayableFranchises,
  chooseWeightedCharacter,
  drawCharacter,
  findPlayableFranchise,
};
