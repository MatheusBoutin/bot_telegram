const { XpTransaction, User } = require("../database/models");

const { XP_HISTORY_LIMIT } = require("../config/adminXpConfig");

const { telegramRequest } = require("../telegram");

const { getTargetFromReply } = require("../services/replyTargetService");

const sourceLabels = {
  admin_reward: "recompensa",
  admin_adjustment: "ajuste",
  reversal: "estorno",
};

function formatSignedXp(amount) {
  return amount > 0 ? `+${amount}` : String(amount);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(date));
}

async function xpHistoryCommand(message, club) {
  const target = await getTargetFromReply(message, club);

  if (!target.ok) {
    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,
      text: target.error,
    });

    return;
  }

  const transactions = await XpTransaction.findAll({
    where: {
      clubId: club.id,
      clubMemberId: target.member.id,
    },

    include: [
      {
        model: User,
        as: "admin",
        attributes: ["id", "name"],
        required: false,
      },
    ],

    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"],
    ],

    limit: XP_HISTORY_LIMIT,
  });

  if (transactions.length === 0) {
    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,
      text:
        `${target.user.name} ainda não possui ` + `alterações manuais de XP.`,
    });

    return;
  }

  const lines = transactions.map((xpTransaction) => {
    const source = sourceLabels[xpTransaction.source] || xpTransaction.source;

    const adminName = xpTransaction.admin?.name || "Sistema";

    let line =
      `#${xpTransaction.id} • ` +
      `${formatSignedXp(xpTransaction.amount)} XP` +
      ` • ${source}\n` +
      `${formatDate(xpTransaction.createdAt)} ` +
      `• por ${adminName}\n` +
      `Motivo: ${xpTransaction.reason}`;

    if (xpTransaction.originalTransactionId) {
      line +=
        `\nDesfez a transação ` + `#${xpTransaction.originalTransactionId}`;
    }

    return line;
  });

  const response =
    `🧾 Histórico de XP — ${target.user.name}\n` +
    `Clube: ${club.name}\n\n` +
    lines.join("\n\n");

  await telegramRequest("sendMessage", {
    chat_id: message.chat.id,
    text: response,
  });
}

module.exports = {
  xpHistoryCommand,
};
