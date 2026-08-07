const XP_MIN = 3;
const XP_MAX = 7;

// 3 segundos para testes.
const XP_COOLDOWN = 3000;

const MIN_MESSAGE_LENGTH = 4;

// Mensagem igual não pode dar XP novamente durante 2 minutos.
const DUPLICATE_COOLDOWN = 120000;

const XP_PER_LEVEL = 100;

module.exports = {
  XP_MIN,
  XP_MAX,
  XP_COOLDOWN,
  MIN_MESSAGE_LENGTH,
  DUPLICATE_COOLDOWN,
  XP_PER_LEVEL,
};
