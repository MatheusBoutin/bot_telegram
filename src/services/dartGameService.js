const { sequelize, DartPlayer, Franchise, DartCharacter } = require("../database/models");
const { DARTS_PER_DAY, DARTS_TIME_ZONE, DART_RARITY_WEIGHTS } = require("../config/dartGameConfig");

function getDartDay(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: DARTS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function findOrCreateLockedPlayer(userId, transaction) {
  const [player, created] = await DartPlayer.findOrCreate({
    where: { userId },
    defaults: { dartsAvailable: DARTS_PER_DAY, dartsRefreshedOn: getDartDay() },
    transaction,
  });
  if (!created) await player.reload({ transaction, lock: transaction.LOCK.UPDATE });
  return player;
}

function refreshPlayerForDay(player, today) {
  if (player.dartsRefreshedOn !== today) {
    player.dartsAvailable = DARTS_PER_DAY;
    player.dartsRefreshedOn = today;
    return true;
  }
  return false;
}

async function getDartPlayer(user, date = new Date()) {
  return sequelize.transaction(async (transaction) => {
    const player = await findOrCreateLockedPlayer(user.id, transaction);
    if (refreshPlayerForDay(player, getDartDay(date))) await player.save({ transaction });
    return player;
  });
}

async function refreshDailyDarts(playerOrUser, date = new Date()) {
  const user = playerOrUser.userId ? { id: playerOrUser.userId } : playerOrUser;
  return getDartPlayer(user, date);
}

async function consumeDart(user, date = new Date()) {
  return sequelize.transaction(async (transaction) => {
    const player = await findOrCreateLockedPlayer(user.id, transaction);
    refreshPlayerForDay(player, getDartDay(date));
    if (player.dartsAvailable <= 0) {
      await player.save({ transaction });
      return { consumed: false, remainingDarts: 0, player };
    }
    player.dartsAvailable -= 1;
    await player.save({ transaction });
    return { consumed: true, remainingDarts: player.dartsAvailable, player };
  });
}

async function refundDart(user) {
  return sequelize.transaction(async (transaction) => {
    const player = await findOrCreateLockedPlayer(user.id, transaction);
    refreshPlayerForDay(player, getDartDay());
    player.dartsAvailable = Math.min(DARTS_PER_DAY, player.dartsAvailable + 1);
    await player.save({ transaction });
    return player;
  });
}

async function getPlayableFranchises() {
  const franchises = await Franchise.findAll({ where: { active: true }, order: [["name", "ASC"]] });
  const values = await Promise.all(franchises.map(async (franchise) => ({
    franchise,
    characterCount: await DartCharacter.count({ where: { franchiseId: franchise.id, active: true } }),
  })));
  return values.filter(({ characterCount }) => characterCount > 0);
}

function getCharacterWeight(character) { return DART_RARITY_WEIGHTS[character.rarity] || 1; }
function chooseWeightedCharacter(characters, random = Math.random) {
  if (characters.length === 0) return null;
  const total = characters.reduce((sum, character) => sum + getCharacterWeight(character), 0);
  let selected = random() * total;
  for (const character of characters) {
    selected -= getCharacterWeight(character);
    if (selected < 0) return character;
  }
  return characters.at(-1);
}

async function drawCharacter(franchise) {
  return chooseWeightedCharacter(await DartCharacter.findAll({ where: { franchiseId: franchise.id, active: true } }));
}

async function findPlayableFranchise(franchiseId) {
  const franchise = await Franchise.findOne({ where: { id: franchiseId, active: true } });
  if (!franchise) return null;
  return (await DartCharacter.count({ where: { franchiseId: franchise.id, active: true } })) > 0 ? franchise : null;
}

module.exports = {
  getDartDay, getDartPlayer, refreshDailyDarts, consumeDart, refundDart,
  getPlayableFranchises, chooseWeightedCharacter, drawCharacter, findPlayableFranchise,
  refreshPlayerForDay,
};
