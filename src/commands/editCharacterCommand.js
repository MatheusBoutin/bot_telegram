const { telegramRequest } = require("../telegram");
const { listActiveCatalogCharacters, findCharacterById } = require("../services/dartCatalogService");
const { saveCatalogSession } = require("../services/dartCatalogSessionService");
const { parseNumericId, resolvePublicItem } = require("./dartCatalogCommand");
const { DART_RARITY_LABELS, DART_RARITY_EMOJIS } = require("../config/dartConfig");

function editorKeyboard() {
  return { inline_keyboard: [
    [{ text: "✏️ Editar nome", callback_data: "catalog:edit:name" }, { text: "✏️ Editar texto", callback_data: "catalog:edit:text" }],
    [{ text: "🖼️ Alterar imagem", callback_data: "catalog:edit:image" }],
    [{ text: "💾 Salvar alterações", callback_data: "catalog:edit:save" }, { text: "🗑️ Excluir carta", callback_data: "catalog:edit:delete" }],
    [{ text: "❌ Cancelar", callback_data: "catalog:edit:cancel" }],
  ] };
}

function editorCaption(card, draft) {
  return `✏️ Editando carta\n\nNome: ${draft.name}\nFranquia: ${card.franchise.name}\nRaridade: ${DART_RARITY_EMOJIS[draft.rarity]} ${DART_RARITY_LABELS[draft.rarity]}\nTexto: ${draft.description}`;
}

async function sendEditorPreview(chatId, card, draft) {
  return telegramRequest("sendPhoto", { chat_id: chatId, photo: draft.imageFileId, caption: editorCaption(card, draft), reply_markup: editorKeyboard() });
}

async function editCharacterCommand(message, user) {
  const number = parseNumericId(message.text);
  if (!number) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Como usar: /editarcarta <número>\n\nConsulte a numeração em /cartas." });
  const cards = await listActiveCatalogCharacters();
  const card = resolvePublicItem(cards, number);
  if (!card) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Carta não encontrada. Use /cartas para consultar a numeração atual." });
  const draft = { name: card.name, normalizedName: card.normalizedName, description: card.description, rarity: card.rarity, imageFileId: card.imageFileId, imageUniqueId: card.imageUniqueId };
  saveCatalogSession(message.chat.id, user.id, { stage: "editing", characterId: card.id, draft, originalDraft: { ...draft } });
  return sendEditorPreview(message.chat.id, card, draft);
}

module.exports = { editCharacterCommand, editorKeyboard, editorCaption, sendEditorPreview };
