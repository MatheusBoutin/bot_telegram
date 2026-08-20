const { telegramRequest } = require("../telegram");
const { DART_RARITY_LABELS, DART_RARITY_EMOJIS } = require("../config/dartConfig");
const { parseCharacterCaption } = require("./dartCatalogParser");
const { findActiveFranchise } = require("./dartCatalogService");
const { canManageBot } = require("./botAdminService");
const { getCatalogSession, saveCatalogSession, clearCatalogSession } = require("./dartCatalogSessionService");

function buildCharacterPreviewCaption(franchise, data) {
  return `🎴 Prévia da carta\n\nFranquia: ${franchise.name}\nNome: ${data.name}\n${DART_RARITY_EMOJIS[data.rarity]} Raridade: ${DART_RARITY_LABELS[data.rarity]}\n\n${data.description}\n\nConfirme ou cancele o cadastro.`;
}

async function handleCatalogUpload(message, adminUser) {
  const chatId = message.chat.id;
  const session = getCatalogSession(chatId, adminUser.id);
  if (!session) return false;

  if (!(await canManageBot(adminUser))) {
    clearCatalogSession(chatId, adminUser.id);
    await telegramRequest("sendMessage", { chat_id: chatId, text: "Seu acesso ao catálogo não está mais disponível." });
    return true;
  }
  const command = message.text?.trim().split(/\s+/, 1)[0].split("@")[0].toLowerCase();
  if (command === "/cancelar") {
    clearCatalogSession(chatId, adminUser.id);
    await telegramRequest("sendMessage", { chat_id: chatId, text: "Cadastro de carta cancelado." });
    return true;
  }
  if (!Array.isArray(message.photo) || message.photo.length === 0) return false;
  if (session.stage !== "awaiting_photo") {
    await telegramRequest("sendMessage", { chat_id: chatId, text: "Já existe uma prévia aguardando confirmação. Use os botões Confirmar ou Cancelar." });
    return true;
  }
  const parsed = parseCharacterCaption(message.caption);
  if (!parsed.ok) {
    await telegramRequest("sendMessage", { chat_id: chatId, text: parsed.error });
    return true;
  }
  const franchise = await findActiveFranchise(session.franchiseId);
  if (!franchise) {
    clearCatalogSession(chatId, adminUser.id);
    await telegramRequest("sendMessage", { chat_id: chatId, text: "A franquia não está mais disponível. Inicie novamente com /adicionarcarta." });
    return true;
  }
  const photo = message.photo.at(-1);
  const characterData = { ...parsed, imageFileId: photo.file_id, imageUniqueId: photo.file_unique_id || null };
  saveCatalogSession(chatId, adminUser.id, { stage: "awaiting_confirmation", franchiseId: franchise.id, characterData });
  await telegramRequest("sendPhoto", {
    chat_id: chatId, photo: characterData.imageFileId,
    caption: buildCharacterPreviewCaption(franchise, characterData),
    reply_markup: { inline_keyboard: [[
      { text: "✅ Confirmar", callback_data: "catalog:confirm" },
      { text: "❌ Cancelar", callback_data: "catalog:cancel" },
    ]] },
  });
  return true;
}

module.exports = { handleCatalogUpload, buildCharacterPreviewCaption };
