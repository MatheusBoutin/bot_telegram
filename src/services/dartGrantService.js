const { sequelize, User, DartGrant } = require("../database/models");
const { getDartDay, refreshPlayerForDay, findOrCreateLockedPlayer } = require("./dartGameService");
const { MAX_ADMIN_DART_GRANT } = require("../config/dartAdminConfig");

class DartGrantError extends Error {
  constructor(code, message) { super(message); this.name = "DartGrantError"; this.code = code; }
}

function validateAmount(amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_ADMIN_DART_GRANT) {
    throw new DartGrantError("INVALID_AMOUNT", "A quantidade deve ser um inteiro positivo dentro do limite seguro do banco.");
  }
}

async function grantDarts({ targetTelegramId, adminUser, amount, reason, telegramUpdateId, date = new Date() }) {
  validateAmount(amount);
  if (!Number.isSafeInteger(Number(telegramUpdateId)) || Number(telegramUpdateId) < 0) {
    throw new DartGrantError("INVALID_UPDATE", "Não foi possível identificar esta atualização do Telegram.");
  }
  try {
    return await sequelize.transaction(async (transaction) => {
      const duplicate = await DartGrant.findOne({ where: { telegramUpdateId: String(telegramUpdateId) }, transaction });
      if (duplicate) return { duplicate: true, grant: duplicate };
      const user = await User.findOne({ where: { telegramId: String(targetTelegramId) }, transaction, lock: transaction.LOCK.UPDATE });
      if (!user) throw new DartGrantError("USER_NOT_FOUND", "Esse Telegram ID não foi encontrado entre os usuários conhecidos pelo bot.");
      const player = await findOrCreateLockedPlayer(user.id, transaction, getDartDay(date));
      refreshPlayerForDay(player, getDartDay(date));
      const newBalance = player.dartsAvailable + amount;
      if (newBalance > MAX_ADMIN_DART_GRANT) throw new DartGrantError("BALANCE_OVERFLOW", "O saldo resultante excede o limite seguro do banco.");
      player.dartsAvailable = newBalance;
      await player.save({ transaction });
      const grant = await DartGrant.create({ userId: user.id, adminUserId: adminUser.id, amount, reason: reason || null, telegramUpdateId: String(telegramUpdateId) }, { transaction });
      return { duplicate: false, grant, user, newBalance, player };
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      const grant = await DartGrant.findOne({ where: { telegramUpdateId: String(telegramUpdateId) } });
      if (grant) return { duplicate: true, grant };
    }
    throw error;
  }
}

module.exports = { DartGrantError, grantDarts, validateAmount };
