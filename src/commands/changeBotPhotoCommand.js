const { User } = require("../database/models");
const telegram = require("../telegram");
const { isOwnerTelegramId, canManageBot } = require("../services/botAdminService");
const profileService = require("../services/botProfileService");

const UNAUTHORIZED_MESSAGE = "Somente o owner e administradores globais podem usar este comando.";
const reply = (message, text) => telegram.telegramRequest("sendMessage", { chat_id: message.chat.id, text });

function selectLargestPhoto(message) {
  const photos = message.photo?.length ? message.photo : message.reply_to_message?.photo;
  return Array.isArray(photos) && photos.length ? photos.at(-1) : null;
}

async function resolveGlobalManager(message) {
  if (isOwnerTelegramId(message.from.id)) return { telegramId: String(message.from.id) };
  const user = await User.findOne({ where: { telegramId: String(message.from.id) } });
  return (await canManageBot(user)) ? user : null;
}

async function changeBotPhotoCommand(message) {
  if (message.chat.type !== "private") return reply(message, "Use este comando no privado do bot.");
  let actor = await resolveGlobalManager(message);
  if (!actor) return reply(message, UNAUTHORIZED_MESSAGE);
  const photo = selectLargestPhoto(message);
  if (!photo?.file_id) return reply(message, "Envie uma foto com a legenda /trocarfoto ou responda a uma foto usando /trocarfoto.");

  try {
    const result = await profileService.changeBotProfilePhoto(photo, async () => {
      actor = await resolveGlobalManager(message);
      return Boolean(actor);
    });
    if (result.reason === "too_large") return reply(message, "A imagem é muito grande. Envie uma foto de até 10 MB.");
    if (result.reason === "unauthorized") return reply(message, UNAUTHORIZED_MESSAGE);
    return reply(message, "✅ Foto de perfil do bot atualizada.");
  } catch (error) {
    console.error("Falha ao atualizar foto do bot:", telegram.redactTelegramSecrets(error));
    return reply(message, "Não foi possível atualizar a foto do bot. Tente novamente.");
  } finally {
    actor = null;
  }
}

module.exports = { changeBotPhotoCommand, selectLargestPhoto, resolveGlobalManager, UNAUTHORIZED_MESSAGE };
