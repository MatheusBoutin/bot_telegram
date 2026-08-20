const DART_RARITIES = Object.freeze([
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
]);

const DART_RARITY_LABELS = Object.freeze({
  common: "Comum",
  uncommon: "Incomum",
  rare: "Raro",
  epic: "Épico",
  legendary: "Lendário",
});

const DART_RARITY_EMOJIS = Object.freeze({
  common: "⚪",
  uncommon: "🟢",
  rare: "🔵",
  epic: "🟣",
  legendary: "🟡",
});

const DART_CATALOG_SESSION_DURATION_MS = 10 * 60 * 1000;

const FRANCHISE_NAME_MAX_LENGTH = 120;
const CHARACTER_NAME_MAX_LENGTH = 120;
const CHARACTER_DESCRIPTION_MAX_LENGTH = 1200;

module.exports = {
  DART_RARITIES,
  DART_RARITY_LABELS,
  DART_RARITY_EMOJIS,
  DART_CATALOG_SESSION_DURATION_MS,
  FRANCHISE_NAME_MAX_LENGTH,
  CHARACTER_NAME_MAX_LENGTH,
  CHARACTER_DESCRIPTION_MAX_LENGTH,
};
