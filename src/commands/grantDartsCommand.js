const { telegramRequest } = require("../telegram");
const { User } = require("../database/models");
const { getOrCreateUserFromTelegramUser } = require("../services/userService");
const { isGroupChat } = require("../services/adminService");
const { grantDarts, DartGrantError } = require("../services/dartGrantService");
const { DART_GRANT_REASON_MAX_LENGTH } = require("../config/dartAdminConfig");

function parseGrant(message) {
  const parts = (message.text || "").trim().split(/\s+/).slice(1);
  const group = isGroupChat(message.chat);
  const targetId = group ? message.reply_to_message?.from?.id : parts.shift();
  const amountText = group ? parts.shift() : parts.shift();
  if (!targetId && group) return { error: "Responda à mensagem do usuário e use:\n\n/daracervos <quantidade> [motivo]" };
  if (!group && (!/^\d+$/.test(String(targetId || "")) || String(targetId) === "0")) return { error: "No privado, informe um Telegram ID numérico válido." };
  if (!/^[1-9]\d*$/.test(String(amountText || ""))) return { error: "Informe uma quantidade inteira positiva de explorações." };
  const amount = Number(amountText);
  if (!Number.isSafeInteger(amount)) return { error: "A quantidade está fora do limite seguro." };
  const reason = parts.join(" ").trim();
  if (reason.length > DART_GRANT_REASON_MAX_LENGTH) return { error: `O motivo pode ter no máximo ${DART_GRANT_REASON_MAX_LENGTH} caracteres.` };
  return { targetId: String(targetId), amount, reason };
}

async function grantDartsCommand(message, adminUser, updateId = message.update_id ?? message.message_id) {
  const parsed = parseGrant(message);
  if (parsed.error) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: parsed.error });
  if (isGroupChat(message.chat) && parsed.targetId && message.reply_to_message.from.is_bot) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Bots não podem receber explorações." });
  if (!isGroupChat(message.chat)) {
    const known = await User.findOne({ where: { telegramId: parsed.targetId } });
    if (!known) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Esse Telegram ID não foi encontrado entre os usuários conhecidos pelo bot." });
  } else await getOrCreateUserFromTelegramUser(message.reply_to_message.from);
  try {
    const result = await grantDarts({ targetTelegramId: parsed.targetId, adminUser, amount: parsed.amount, reason: parsed.reason, telegramUpdateId: updateId });
    if (result.duplicate) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Este comando já foi processado; nenhuma exploração foi adicionada novamente." });
    const unit = parsed.amount === 1 ? "exploração" : "explorações";
    let adminText = `✅ ${parsed.amount} ${unit} adicionada${parsed.amount === 1 ? "" : "s"} para ${result.user.name}.\n\n Novo saldo: ${result.newBalance}`;
    try {
      await telegramRequest("sendMessage", { chat_id: result.user.telegramId, text: `Você recebeu ${parsed.amount} ${unit} do acervo.\n\n Saldo atual: ${result.newBalance}` });
    } catch (error) {
      console.warn(`Não foi possível notificar ${result.user.telegramId} sobre a concessão de acervo:`, error.message);
      adminText += "\n\n⚠️ O saldo foi alterado, mas a notificação privada não pôde ser entregue.";
    }
    return telegramRequest("sendMessage", { chat_id: message.chat.id, text: adminText });
  } catch (error) {
    if (error instanceof DartGrantError) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: error.message });
    throw error;
  }
}

module.exports = { grantDartsCommand, parseGrant };
