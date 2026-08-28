const { telegramRequest } = require("../telegram");
const { getOrCreateUser } = require("../services/userService");
const { canManageBot } = require("../services/botAdminService");
const { findActiveFranchise, createDartCharacter, archiveCharacter, archiveFranchise, findCharacterById, updateDartCharacter } = require("../services/dartCatalogService");
const { DART_RARITY_LABELS, DART_RARITY_EMOJIS } = require("../config/dartConfig");
const { saveCatalogSession, getCatalogSession, clearCatalogSession, takeCatalogSession, clearCatalogSessionsForFranchise } = require("../services/dartCatalogSessionService");
const { sendEditorPreview } = require("../commands/editCharacterCommand");

const isCatalogCallback = (query) => query.data?.startsWith("catalog:") || false;
async function removeKeyboard(query) {
  await telegramRequest("editMessageReplyMarkup", { chat_id: query.message.chat.id, message_id: query.message.message_id, reply_markup: { inline_keyboard: [] } });
}
async function finishArchiveMessage(query, text) {
  await telegramRequest("editMessageText", {
    chat_id: query.message.chat.id,
    message_id: query.message.message_id,
    text,
    reply_markup: { inline_keyboard: [] },
  });
}
async function startUpload(query, user) {
  const match = query.data.match(/^catalog:add:(\d+)$/);
  if (!match) return;
  const franchise = await findActiveFranchise(Number(match[1]));
  if (!franchise) return telegramRequest("sendMessage", { chat_id: query.message.chat.id, text: "Essa franquia não está mais disponível." });
  saveCatalogSession(query.message.chat.id, user.id, { stage: "awaiting_photo", franchiseId: franchise.id });
  await telegramRequest("sendMessage", {
    chat_id: query.message.chat.id,
    text: `Franquia escolhida: ${franchise.name}\n\nEnvie os dados da nova carta em uma imagem com a legenda:\nNome / raridade / descrição\n\nRaridades: comum, incomum, raro, épico e lendário.\nA imagem da carta é obrigatória. O cadastro expira em 10 minutos.`,
  });
}
async function confirm(query, user) {
  const chatId = query.message.chat.id;
  const session = getCatalogSession(chatId, user.id);
  if (!session || session.stage !== "awaiting_confirmation") return telegramRequest("sendMessage", { chat_id: chatId, text: "Esse cadastro expirou ou já foi finalizado. Use /adicionarcarta novamente." });
  if (!(await canManageBot(user))) {
    clearCatalogSession(chatId, user.id);
    return telegramRequest("sendMessage", { chat_id: chatId, text: "Seu acesso administrativo foi removido." });
  }
  const franchise = await findActiveFranchise(session.franchiseId);
  if (!franchise) {
    clearCatalogSession(chatId, user.id);
    return telegramRequest("sendMessage", { chat_id: chatId, text: "A franquia não está mais disponível." });
  }
  try {
    if (!(await canManageBot(user))) {
      clearCatalogSession(chatId, user.id);
      return telegramRequest("sendMessage", { chat_id: chatId, text: "Seu acesso administrativo foi removido." });
    }
    const character = await createDartCharacter({ franchise, adminUser: user, characterData: session.characterData });
    clearCatalogSession(chatId, user.id);
    await removeKeyboard(query);
    await telegramRequest("sendMessage", { chat_id: chatId, text: `✅ Carta adicionada com sucesso.\n\n${character.name} foi adicionada à franquia ${franchise.name}.` });
  } catch (error) {
    if (error.name !== "SequelizeUniqueConstraintError") throw error;
    clearCatalogSession(chatId, user.id);
    await removeKeyboard(query);
    await telegramRequest("sendMessage", { chat_id: chatId, text: "Já existe uma carta com esse nome nessa franquia. Use /adicionarcarta novamente." });
  }
}

async function archiveCatalogItem(query, user) {
  const chatId = query.message.chat.id;
  if (query.message.chat.type !== "private") return telegramRequest("answerCallbackQuery", { callback_query_id: query.id, text: "Esta confirmação administrativa funciona somente no privado." });
  const match = query.data.match(/^catalog:archive:(card|franchise):(confirm|cancel)$/);
  if (!match) return telegramRequest("answerCallbackQuery", { callback_query_id: query.id });
  const expectedStage = match[1] === "card" ? "archive_card" : "archive_franchise";
  const session = takeCatalogSession(chatId, user.id, expectedStage);
  if (!session) return telegramRequest("answerCallbackQuery", { callback_query_id: query.id, text: "Esta exclusão já foi processada." });
  if (match[2] === "cancel") {
    await telegramRequest("answerCallbackQuery", { callback_query_id: query.id });
    return finishArchiveMessage(query, "❌ Exclusão cancelada.");
  }
  if (!(await canManageBot(user))) return telegramRequest("answerCallbackQuery", { callback_query_id: query.id, text: "Seu acesso administrativo foi removido." });
  await telegramRequest("answerCallbackQuery", { callback_query_id: query.id });
  if (match[1] === "card") {
    const result = await archiveCharacter(session.characterId);
    if (!result) return finishArchiveMessage(query, "Carta não encontrada.");
    if (!result.changed) return finishArchiveMessage(query, "A remoção desta carta já foi processada.");
    return finishArchiveMessage(query, "✅ Carta removida do catálogo.\n\nEla não aparecerá em novos sorteios nem em /cartas.");
  }
  const result = await archiveFranchise(session.franchiseId);
  clearCatalogSessionsForFranchise(session.franchiseId);
  if (!result) return finishArchiveMessage(query, "Franquia não encontrada.");
  if (!result.changed) return finishArchiveMessage(query, "A remoção desta franquia já foi processada.");
  return finishArchiveMessage(query, `✅ Franquia removida do catálogo.\n\n${result.characterCount} cartas foram removidas dos sorteios. As aquisições existentes continuam preservadas nas coleções.`);
}

async function editCallback(query, user) {
  const chatId = query.message.chat.id;
  if (query.message.chat.type !== "private") return telegramRequest("answerCallbackQuery", { callback_query_id: query.id, text: "Este comando funciona somente no privado." });
  const action = query.data.match(/^catalog:edit:(name|text|image|save|delete|cancel)$/)?.[1];
  if (!action) return false;
  const session = getCatalogSession(chatId, user.id);
  if (!session || !["editing", "editing_name", "editing_text", "editing_image", "editing_delete"].includes(session.stage)) return telegramRequest("answerCallbackQuery", { callback_query_id: query.id, text: "Esta edição expirou ou já foi finalizada." });
  await telegramRequest("answerCallbackQuery", { callback_query_id: query.id });
  if (action === "cancel") { clearCatalogSession(chatId, user.id); return finishArchiveMessage(query, "❌ Edição cancelada. Nenhuma alteração foi salva."); }
  if (action === "name" || action === "text" || action === "image") {
    saveCatalogSession(chatId, user.id, { ...session, stage: `editing_${action}` });
    return telegramRequest("sendMessage", { chat_id: chatId, text: action === "name" ? "Envie o novo nome da carta." : action === "text" ? "Envie o novo texto da carta." : "Envie uma nova foto da carta." });
  }
  if (action === "delete") {
    saveCatalogSession(chatId, user.id, { ...session, stage: "editing_delete" });
    return telegramRequest("editMessageText", { chat_id: chatId, message_id: query.message.message_id, text: "⚠️ Deseja realmente excluir esta carta?", reply_markup: { inline_keyboard: [[{ text: "✅ Confirmar exclusão", callback_data: "catalog:edit:delete_confirm" }, { text: "❌ Voltar", callback_data: "catalog:edit:delete_back" }]] } });
  }
  if (action === "save") {
    if (session.stage !== "editing") return telegramRequest("sendMessage", { chat_id: chatId, text: "Aguarde a nova informação antes de salvar." });
    try { const character = await updateDartCharacter({ characterId: session.characterId, characterData: session.draft }); clearCatalogSession(chatId, user.id); if (!character) return finishArchiveMessage(query, "Carta não encontrada."); await finishArchiveMessage(query, "✅ Carta atualizada com sucesso."); const fresh = await findCharacterById(character.id); return sendEditorPreview(chatId, fresh, { ...session.draft }); } catch (error) { if (error.name === "SequelizeUniqueConstraintError") return telegramRequest("sendMessage", { chat_id: chatId, text: "Já existe uma carta com esse nome nessa franquia." }); throw error; }
  }
  return false;
}

async function editDeleteCallback(query, user) {
  const chatId = query.message.chat.id;
  const action = query.data.endsWith("_confirm") ? "confirm" : "back";
  const session = getCatalogSession(chatId, user.id);
  if (!session || session.stage !== "editing_delete") return telegramRequest("answerCallbackQuery", { callback_query_id: query.id, text: "Esta exclusão já foi processada." });
  await telegramRequest("answerCallbackQuery", { callback_query_id: query.id });
  if (action === "back") { saveCatalogSession(chatId, user.id, { ...session, stage: "editing" }); const card = await findCharacterById(session.characterId); return sendEditorPreview(chatId, card, session.draft); }
  const result = await archiveCharacter(session.characterId); clearCatalogSession(chatId, user.id); if (!result || !result.changed) return finishArchiveMessage(query, "A remoção desta carta já foi processada."); return finishArchiveMessage(query, "✅ Carta removida do catálogo.\n\nEla não aparecerá em novos sorteios nem em /cartas.");
}

async function handleDartCatalogCallback(query) {
  if (!isCatalogCallback(query)) return false;
  if (!query.message?.chat || !query.from) return true;
  const chatId = query.message.chat.id;
  const user = await getOrCreateUser({ chat: query.message.chat, from: query.from });
  if (query.message.chat.type !== "private" && query.data.startsWith("catalog:edit:")) {
    await telegramRequest("answerCallbackQuery", { callback_query_id: query.id, text: "Este comando funciona somente no privado." });
    return true;
  }
  if (!(await canManageBot(user))) {
    clearCatalogSession(chatId, user.id);
    await telegramRequest("answerCallbackQuery", { callback_query_id: query.id, text: "Este botão exige acesso de administrador global do bot." });
    return true;
  }
  if (query.data.startsWith("catalog:edit:delete_")) await editDeleteCallback(query, user);
  else if (query.data.startsWith("catalog:edit:")) await editCallback(query, user);
  else if (query.data.startsWith("catalog:archive:")) await archiveCatalogItem(query, user);
  else {
    await telegramRequest("answerCallbackQuery", { callback_query_id: query.id });
    if (query.data.startsWith("catalog:add:")) await startUpload(query, user);
    else if (query.data === "catalog:confirm") await confirm(query, user);
    else if (query.data === "catalog:cancel") {
      clearCatalogSession(chatId, user.id);
      await removeKeyboard(query);
      await telegramRequest("sendMessage", { chat_id: chatId, text: "Cadastro de carta cancelado." });
    }
  }
  return true;
}

module.exports = { handleDartCatalogCallback, isCatalogCallback };
