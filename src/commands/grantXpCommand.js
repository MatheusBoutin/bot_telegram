const { telegramRequest } = require("../telegram");

const { parseXpChangeCommand } = require("../services/adminXpParser");

const { getTargetFromReply } = require("../services/replyTargetService");

const { AdminXpError, applyXpChange } = require("../services/adminXpService");

async function grantXpCommand(message, adminUser, club) {
  const parsedCommand = parseXpChangeCommand(message.text, {
    allowNegative: false,
  });

  if (!parsedCommand.ok) {
    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,
      text:
        `Uso: responda à mensagem do membro com\n` +
        `/darxp 100 Motivo da recompensa\n\n` +
        parsedCommand.error,
    });

    return;
  }

  const target = await getTargetFromReply(message, club);

  if (!target.ok) {
    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,
      text: target.error,
    });

    return;
  }

  try {
    const result = await applyXpChange({
      club,
      member: target.member,
      adminUser,
      amount: parsedCommand.amount,
      source: "admin_reward",
      reason: parsedCommand.reason,
      telegramMessageId: message.message_id,
    });

    if (result.duplicate) {
      await telegramRequest("sendMessage", {
        chat_id: message.chat.id,
        text:
          `Este comando já foi processado na ` +
          `transação #${result.xpTransaction.id}.`,
      });

      return;
    }

    let response =
      `🎁 ${target.user.name} recebeu ` +
      `${parsedCommand.amount} XP!\n\n` +
      `📝 Motivo: ${parsedCommand.reason}\n` +
      `✨ Total: ${result.newXp} XP\n` +
      `⭐ Nível: ${result.newLevel}\n` +
      `🧾 Transação: #${result.xpTransaction.id}`;

    if (result.previousLevel !== result.newLevel) {
      response +=
        `\n\n🎉 Nível alterado: ` +
        `${result.previousLevel} → ${result.newLevel}`;
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
  grantXpCommand,
};
