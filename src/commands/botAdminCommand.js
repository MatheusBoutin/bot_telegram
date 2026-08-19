const { telegramRequest } = require("../telegram");
const { User } = require("../database/models");
const { getOrCreateUserFromTelegramUser } = require("../services/userService");
const { canManageBot, grantBotAdmin, revokeBotAdmin } = require("../services/botAdminService");

const reply = (message, text) => telegramRequest("sendMessage", { chat_id: message.chat.id, text });
async function meuidCommand(message) { await reply(message, `Seu ID do Telegram é: ${message.from.id}`); }

async function resolveTarget(message) {
  const telegramUser = message.reply_to_message?.from;
  if (telegramUser) {
    if (telegramUser.is_bot) return { error: "Bots não podem receber o cargo de administrador global." };
    return { user: await getOrCreateUserFromTelegramUser(telegramUser) };
  }
  const rawId = message.text?.trim().split(/\s+/)[1];
  if (!rawId || !/^\d+$/.test(rawId) || rawId === "0") return { error: "Informe um ID numérico válido ou responda à mensagem da pessoa." };
  const user = await User.findOne({ where: { telegramId: rawId.replace(/^0+(?=\d)/, "") } });
  return user ? { user } : { error: "Esse usuário ainda não interagiu com o bot. Peça para ele enviar /meuid primeiro." };
}

async function ensureManager(message, actor) {
  if (await canManageBot(actor)) return true;
  await reply(message, "Somente o owner e administradores globais podem usar este comando.");
  return false;
}

async function grantAdminCommand(message, actor) {
  if (!(await ensureManager(message, actor))) return;
  const target = await resolveTarget(message);
  if (target.error) return reply(message, target.error);
  const result = await grantBotAdmin(target.user, actor);
  if (result.owner) return reply(message, "O owner já possui acesso administrativo permanente.");
  return reply(message, result.changed ? `✅ ${target.user.name} agora é administrador global.` : `${target.user.name} já é administrador global.`);
}

async function removeAdminCommand(message, actor) {
  if (!(await ensureManager(message, actor))) return;
  const target = await resolveTarget(message);
  if (target.error) return reply(message, target.error);
  const result = await revokeBotAdmin(target.user, actor);
  if (result.owner) return reply(message, "O owner não pode ser removido ou rebaixado.");
  return reply(message, result.changed ? `✅ ${target.user.name} deixou de ser administrador global.` : `${target.user.name} não é administrador global ativo.`);
}

function formatTelegramName(user) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return fullName || (user.username ? `@${user.username}` : `ID ${user.id}`);
}

async function listAdminsCommand(message) {
  if (!["group", "supergroup"].includes(message.chat.type)) {
    return reply(message, "Use este comando dentro de um grupo.");
  }

  const administrators = await telegramRequest("getChatAdministrators", {
    chat_id: message.chat.id,
  });
  const lines = administrators
    .filter(({ user }) => user && !user.is_bot)
    .map(({ user }) => `• ${formatTelegramName(user)}`);

  return reply(
    message,
    `Administradores do grupo\n\n${lines.length ? lines.join("\n") : "Nenhum administrador encontrado."}`,
  );
}

module.exports = { meuidCommand, grantAdminCommand, removeAdminCommand, listAdminsCommand, resolveTarget, formatTelegramName };
