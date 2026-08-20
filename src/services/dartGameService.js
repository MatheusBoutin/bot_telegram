const { sequelize, DartPlayer, Franchise, DartCharacter } = require("../database/models");
const { DARTS_PER_DAY, DARTS_TIME_ZONE, DART_RARITY_WEIGHTS } = require("../config/dartGameConfig");

function getDartDay(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: DARTS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getRenewalCountdown(date = new Date()) {
  const currentDay = getDartDay(date);
  let minutes = 1;
  while (minutes <= 26 * 60 && getDartDay(new Date(date.getTime() + minutes * 60_000)) === currentDay) minutes += 1;
  const hours = Math.floor(minutes / 60); const remainder = minutes % 60;
  return hours > 0 ? `${hours}h${remainder ? ` ${remainder}min` : ""}` : `${remainder}min`;
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
  if (player.dartsRefreshedOn === today) {
    if (player.dartsAvailable <= DARTS_PER_DAY) return false;
    player.dartsAvailable = DARTS_PER_DAY;
    return true;
  }

  const previousDay = player.dartsRefreshedOn
    ? Date.parse(`${player.dartsRefreshedOn}T00:00:00Z`)
    : Number.NaN;
  const currentDay = Date.parse(`${today}T00:00:00Z`);
  const elapsedDays = Math.floor((currentDay - previousDay) / 86_400_000);

  // Não retrocede o controle caso o relógio/data recebida esteja atrasado.
  if (Number.isFinite(elapsedDays) && elapsedDays <= 0) return false;

  // Todo novo dia redefine a cota; dardos não utilizados não acumulam.
  player.dartsAvailable = DARTS_PER_DAY;
  player.dartsRefreshedOn = today;
  return true;
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
    player.dartsAvailable += 1;
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

async function findActiveCharacter(characterId, franchiseId) {
  return DartCharacter.findOne({ where: { id: characterId, franchiseId, active: true } });
}

async function findPlayableFranchise(franchiseId) {
  const franchise = await Franchise.findOne({ where: { id: franchiseId, active: true } });
  if (!franchise) return null;
  return (await DartCharacter.count({ where: { franchiseId: franchise.id, active: true } })) > 0 ? franchise : null;
}

module.exports = {
  getDartDay, getRenewalCountdown, getDartPlayer, refreshDailyDarts, consumeDart, refundDart,
  getPlayableFranchises, chooseWeightedCharacter, drawCharacter, findPlayableFranchise,
  findActiveCharacter,
  refreshPlayerForDay,
};
