const { telegramRequest } = require("../telegram");
const { DART_RARITY_LABELS, DART_RARITY_EMOJIS } = require("../config/dartConfig");
const { parseCharacterCaption } = require("./dartCatalogParser");
const { findActiveFranchise } = require("./dartCatalogService");
const { canManageBot } = require("./botAdminService");
const { getCatalogSession, saveCatalogSession, clearCatalogSession } = require("./dartCatalogSessionService");
const { findCharacterById } = require("./dartCatalogService");
const { normalizeCatalogText } = require("./dartCatalogParser");
const { CHARACTER_NAME_MAX_LENGTH, CHARACTER_DESCRIPTION_MAX_LENGTH } = require("../config/dartConfig");
const { sendEditorPreview } = require("../commands/editCharacterCommand");

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
  if (session.stage === "editing_name" || session.stage === "editing_text") {
    if (typeof message.text !== "string" || !message.text.trim()) return true;
    const value = message.text.trim().replace(/\s+/g, " ");
    const limit = session.stage === "editing_name" ? CHARACTER_NAME_MAX_LENGTH : CHARACTER_DESCRIPTION_MAX_LENGTH;
    if (value.length > limit) {
      await telegramRequest("sendMessage", { chat_id: chatId, text: `O ${session.stage === "editing_name" ? "nome" : "texto"} pode ter no máximo ${limit} caracteres.` });
      return true;
    }
    const draft = { ...session.draft, ...(session.stage === "editing_name" ? { name: value, normalizedName: normalizeCatalogText(value) } : { description: value }) };
    const card = await findCharacterById(session.characterId);
    if (!card || !card.active) { clearCatalogSession(chatId, adminUser.id); return true; }
    saveCatalogSession(chatId, adminUser.id, { ...session, stage: "editing", characterId: card.id, draft });
    await sendEditorPreview(chatId, card, draft);
    await telegramRequest("sendMessage", { chat_id: chatId, text: session.stage === "editing_name" ? "✏️ Nome alterado na prévia. Clique em Salvar alterações para confirmar." : "✏️ Texto alterado na prévia. Clique em Salvar alterações para confirmar." });
    return true;
  }
  if (session.stage === "editing_image") {
    const image = Array.isArray(message.photo) && message.photo.length ? message.photo.at(-1) : (message.document && String(message.document.mime_type || "").startsWith("image/") ? message.document : null);
    if (!image) return true;
    const draft = { ...session.draft, imageFileId: image.file_id, imageUniqueId: image.file_unique_id || null };
    const card = await findCharacterById(session.characterId);
    if (!card || !card.active) { clearCatalogSession(chatId, adminUser.id); return true; }
    saveCatalogSession(chatId, adminUser.id, { ...session, stage: "editing", characterId: card.id, draft });
    await sendEditorPreview(chatId, card, draft);
    await telegramRequest("sendMessage", { chat_id: chatId, text: "🖼️ Imagem alterada na prévia. Clique em Salvar alterações para confirmar." });
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
