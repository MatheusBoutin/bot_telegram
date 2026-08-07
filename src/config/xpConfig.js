const XP_MIN = 3;
const XP_MAX = 7;

// 3 segundos enquanto estamos testando.
// Depois podemos aumentar para 45000.
const XP_COOLDOWN = 3000;

const MIN_MESSAGE_LENGTH = 4;

// Mensagem repetida não dá XP novamente durante 2 minutos.
const DUPLICATE_COOLDOWN = 120000;

// Progressão de nível.
const MAX_LEVEL = 50;

// Nível 1 → 2 exige 100 XP.
const BASE_LEVEL_XP = 100;

// Cada nível seguinte exige +25 XP.
const LEVEL_XP_INCREASE = 25;

module.exports = {
  XP_MIN,
  XP_MAX,
  XP_COOLDOWN,
  MIN_MESSAGE_LENGTH,
  DUPLICATE_COOLDOWN,
  MAX_LEVEL,
  BASE_LEVEL_XP,
  LEVEL_XP_INCREASE,
};
