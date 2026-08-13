const { ClubMember, XpTransaction } = require("../database/models");

const {
  XP_MIN,
  XP_MAX,
  XP_COOLDOWN,
  MIN_MESSAGE_LENGTH,
  DUPLICATE_COOLDOWN,
  MAX_LEVEL,
} = require("../config/xpConfig");

const { MAX_ADMIN_XP_CHANGE } = require("../config/adminXpConfig");

const { telegramRequest } = require("../telegram");

function formatDuration(milliseconds) {
  if (milliseconds < 60000) {
    return `${milliseconds / 1000} segundos`;
  }

  return `${milliseconds / 60000} minutos`;
}

async function xpStatusCommand(message, club) {
  const [memberCount, transactionCount] = await Promise.all([
    ClubMember.count({
      where: {
        clubId: club.id,
      },
    }),

    XpTransaction.count({
      where: {
        clubId: club.id,
      },
    }),
  ]);

  const response =
    `⚙️ Status do XP — ${club.name}\n\n` +
    `XP automático: ${XP_MIN} a ${XP_MAX} por mensagem\n` +
    `Intervalo: ${formatDuration(XP_COOLDOWN)}\n` +
    `Tamanho mínimo: ${MIN_MESSAGE_LENGTH} caracteres\n` +
    `Mensagem repetida: ${formatDuration(DUPLICATE_COOLDOWN)}\n` +
    `Nível máximo: ${MAX_LEVEL}\n` +
    `Limite administrativo: ${MAX_ADMIN_XP_CHANGE} XP\n\n` +
    `Membros registrados: ${memberCount}\n` +
    `Alterações manuais: ${transactionCount}`;

  await telegramRequest("sendMessage", {
    chat_id: message.chat.id,
    text: response,
  });
}

module.exports = {
  xpStatusCommand,
};
