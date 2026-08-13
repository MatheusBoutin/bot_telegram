const { sequelize, ClubMember, XpTransaction } = require("../database/models");

const { calculateLevel } = require("./xpService");

class AdminXpError extends Error {
  constructor(code, message) {
    super(message);

    this.name = "AdminXpError";
    this.code = code;
  }
}

function validateAmount(amount) {
  if (!Number.isSafeInteger(amount) || amount === 0) {
    throw new AdminXpError(
      "INVALID_AMOUNT",
      "A alteração de XP precisa ser um número inteiro diferente de zero.",
    );
  }
}

async function findProcessedCommand(clubId, telegramMessageId) {
  return XpTransaction.findOne({
    where: {
      clubId,
      telegramMessageId: String(telegramMessageId),
    },
  });
}

async function applyXpChange({
  club,
  member,
  adminUser,
  amount,
  source,
  reason,
  telegramMessageId,
}) {
  validateAmount(amount);

  try {
    return await sequelize.transaction(async (databaseTransaction) => {
      const processedCommand = await XpTransaction.findOne({
        where: {
          clubId: club.id,
          telegramMessageId: String(telegramMessageId),
        },
        transaction: databaseTransaction,
      });

      if (processedCommand) {
        return {
          duplicate: true,
          xpTransaction: processedCommand,
        };
      }

      const lockedMember = await ClubMember.findOne({
        where: {
          id: member.id,
          clubId: club.id,
        },
        transaction: databaseTransaction,
        lock: databaseTransaction.LOCK.UPDATE,
      });

      if (!lockedMember) {
        throw new AdminXpError(
          "MEMBER_NOT_FOUND",
          "O membro não foi encontrado neste clube.",
        );
      }

      const previousXp = lockedMember.xp;
      const previousLevel = lockedMember.level;

      const newXp = previousXp + amount;

      if (newXp < 0) {
        throw new AdminXpError(
          "NEGATIVE_XP",
          `Essa alteração deixaria o membro com ${newXp} XP. ` +
            "O total não pode ficar abaixo de zero.",
        );
      }

      const newLevel = calculateLevel(newXp);

      lockedMember.xp = newXp;
      lockedMember.level = newLevel;

      await lockedMember.save({
        transaction: databaseTransaction,
      });

      const xpTransaction = await XpTransaction.create(
        {
          clubMemberId: lockedMember.id,
          clubId: club.id,
          adminUserId: adminUser.id,
          amount,
          source,
          reason,
          telegramMessageId: String(telegramMessageId),
        },
        {
          transaction: databaseTransaction,
        },
      );

      return {
        duplicate: false,
        xpTransaction,
        previousXp,
        previousLevel,
        newXp,
        newLevel,
      };
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      const processedCommand = await findProcessedCommand(
        club.id,
        telegramMessageId,
      );

      if (processedCommand) {
        return {
          duplicate: true,
          xpTransaction: processedCommand,
        };
      }
    }

    throw error;
  }
}

async function undoXpChange({
  club,
  adminUser,
  originalTransactionId,
  reason,
  telegramMessageId,
}) {
  try {
    return await sequelize.transaction(async (databaseTransaction) => {
      const processedCommand = await XpTransaction.findOne({
        where: {
          clubId: club.id,
          telegramMessageId: String(telegramMessageId),
        },
        transaction: databaseTransaction,
      });

      if (processedCommand) {
        return {
          duplicate: true,
          xpTransaction: processedCommand,
        };
      }

      const originalTransaction = await XpTransaction.findOne({
        where: {
          id: originalTransactionId,
          clubId: club.id,
        },
        transaction: databaseTransaction,
        lock: databaseTransaction.LOCK.UPDATE,
      });

      if (!originalTransaction) {
        throw new AdminXpError(
          "TRANSACTION_NOT_FOUND",
          "Essa transação não existe neste clube.",
        );
      }

      if (originalTransaction.source === "reversal") {
        throw new AdminXpError(
          "CANNOT_REVERSE_REVERSAL",
          "Uma transação de estorno não pode ser desfeita novamente.",
        );
      }

      const previousReversal = await XpTransaction.findOne({
        where: {
          originalTransactionId: originalTransaction.id,
        },
        transaction: databaseTransaction,
      });

      if (previousReversal) {
        throw new AdminXpError(
          "ALREADY_REVERSED",
          `A transação #${originalTransaction.id} já foi desfeita ` +
            `pela transação #${previousReversal.id}.`,
        );
      }

      const lockedMember = await ClubMember.findOne({
        where: {
          id: originalTransaction.clubMemberId,
          clubId: club.id,
        },
        transaction: databaseTransaction,
        lock: databaseTransaction.LOCK.UPDATE,
      });

      if (!lockedMember) {
        throw new AdminXpError(
          "MEMBER_NOT_FOUND",
          "O membro relacionado à transação não foi encontrado.",
        );
      }

      const amount = -originalTransaction.amount;

      const previousXp = lockedMember.xp;
      const previousLevel = lockedMember.level;

      const newXp = previousXp + amount;

      if (newXp < 0) {
        throw new AdminXpError(
          "NEGATIVE_XP",
          "Não é possível desfazer essa transação porque o XP ficaria negativo.",
        );
      }

      const newLevel = calculateLevel(newXp);

      lockedMember.xp = newXp;
      lockedMember.level = newLevel;

      await lockedMember.save({
        transaction: databaseTransaction,
      });

      const xpTransaction = await XpTransaction.create(
        {
          clubMemberId: lockedMember.id,
          clubId: club.id,
          adminUserId: adminUser.id,
          amount,
          source: "reversal",
          reason,
          telegramMessageId: String(telegramMessageId),
          originalTransactionId: originalTransaction.id,
        },
        {
          transaction: databaseTransaction,
        },
      );

      return {
        duplicate: false,
        xpTransaction,
        originalTransaction,
        member: lockedMember,
        previousXp,
        previousLevel,
        newXp,
        newLevel,
      };
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      const processedCommand = await findProcessedCommand(
        club.id,
        telegramMessageId,
      );

      if (processedCommand) {
        return {
          duplicate: true,
          xpTransaction: processedCommand,
        };
      }

      const previousReversal = await XpTransaction.findOne({
        where: {
          originalTransactionId,
        },
      });

      if (previousReversal) {
        throw new AdminXpError(
          "ALREADY_REVERSED",
          `Essa transação já foi desfeita pela ` +
            `transação #${previousReversal.id}.`,
        );
      }
    }

    throw error;
  }
}

module.exports = {
  AdminXpError,
  applyXpChange,
  undoXpChange,
};
