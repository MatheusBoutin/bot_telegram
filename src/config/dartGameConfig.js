const DARTS_PER_DAY = 3;
const DARTS_START_DAY = "2026-08-16";

const DARTS_TIME_ZONE = "America/Sao_Paulo";

const DART_GAME_SESSION_DURATION_MS = 10 * 60 * 1000;

const CARD_REVEAL_DELAY_MS = 2000;
const ACERVO_BOOK_ANIMATION = String(process.env.ACERVO_BOOK_ANIMATION || "").trim();

const DART_RARITY_WEIGHTS = Object.freeze({
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1,
});

module.exports = {
  DARTS_PER_DAY,
  DARTS_START_DAY,
  DARTS_TIME_ZONE,
  DART_GAME_SESSION_DURATION_MS,
  CARD_REVEAL_DELAY_MS,
  ACERVO_BOOK_ANIMATION,
  DART_RARITY_WEIGHTS,
};
