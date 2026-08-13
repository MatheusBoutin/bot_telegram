const { User } = require("../database/models");
const { telegramRequest } = require("../telegram");

const { parseUndoXpCommand } = require("../services/adminXpParser");

const { AdminXpError, undoXpChange } = require("../services/adminXpService");

function formatSignedXp(amount) {
  return amount > 0 ? `+${amount}` : String(amount);
}

async function undoXpCommand(message, adminUser, club) {
  const parsedCommand = parseUndoXpCommand(message.text);

  if (!parsedCommand.ok) {
    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,
      text:
        "Como usar:\n" +
        "/desfazerxp número motivo\n\n" +
        'Use o número exibido depois de "Transação: #".\n' +
        "Esse número também aparece no /historico.\n\n" +
        parsedCommand.error,
    });

    return;
  }

  try {
    const result = await undoXpChange({
      club,
      adminUser,
      originalTransactionId: parsedCommand.transactionId,
      reason: parsedCommand.reason,
      telegramMessageId: message.message_id,
    });

    if (result.duplicate) {
      await telegramRequest("sendMessage", {
        chat_id: message.chat.id,
        text:
          "Este comando já foi processado na " +
          `transação #${result.xpTransaction.id}.`,
      });

      return;
    }

    const targetUser = await User.findByPk(result.member.userId);

    const targetName = targetUser?.name || "Membro";

    let response =
      `↩️ Transação #${result.originalTransaction.id} desfeita.\n\n` +
      `👤 ${targetName}\n` +
      `✨ Alteração: ${formatSignedXp(result.xpTransaction.amount)} XP\n` +
      `✨ Total atual: ${result.newXp} XP\n` +
      `⭐ Nível: ${result.newLevel}\n` +
      `📝 Motivo: ${parsedCommand.reason}\n` +
      `🧾 Novo registro: #${result.xpTransaction.id}`;

    if (result.previousLevel !== result.newLevel) {
      response +=
        "\n\nNível alterado: " + `${result.previousLevel} → ${result.newLevel}`;
    }

    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,
      text: response,
    });
  } catch (error) {
    if (error instanceof AdminXpError) {
      await telegramRequest("sendMessage", {
        chat_id: message.chat.id,
        text: error.message,
      });

      return;
    }

    throw error;
  }
}

module.exports = {
  undoXpCommand,
};
