const { telegramRequest } = require("../telegram");
const { getOrCreateUser } = require("../services/userService");
const { canManageBot } = require("../services/botAdminService");
const { findActiveFranchise, createDartCharacter, archiveCharacter, archiveFranchise } = require("../services/dartCatalogService");
const { DART_RARITY_LABELS, DART_RARITY_EMOJIS } = require("../config/dartConfig");
const { saveCatalogSession, getCatalogSession, clearCatalogSession, takeCatalogSession, clearCatalogSessionsForFranchise } = require("../services/dartCatalogSessionService");

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
    if (!result.changed) return finishArchiveMessage(query, "Esta carta já está arquivada.");
    return finishArchiveMessage(query, "✅ Carta removida do catálogo.\n\nEla não aparecerá em novos sorteios nem na listagem de cartas ativas.");
  }
  const result = await archiveFranchise(session.franchiseId);
  clearCatalogSessionsForFranchise(session.franchiseId);
  if (!result) return finishArchiveMessage(query, "Franquia não encontrada.");
  if (!result.changed) return finishArchiveMessage(query, "Esta franquia já está arquivada.");
  return finishArchiveMessage(query, `✅ Franquia removida do catálogo.\n\n${result.characterCount} cartas foram arquivadas. As aquisições existentes continuam preservadas nas coleções.`);
}

async function handleDartCatalogCallback(query) {
  if (!isCatalogCallback(query)) return false;
  if (!query.message?.chat || !query.from) return true;
  const chatId = query.message.chat.id;
  const user = await getOrCreateUser({ chat: query.message.chat, from: query.from });
  if (!(await canManageBot(user))) {
    clearCatalogSession(chatId, user.id);
    await telegramRequest("answerCallbackQuery", { callback_query_id: query.id, text: "Este botão exige acesso de administrador global do bot." });
    return true;
  }
  if (query.data.startsWith("catalog:archive:")) await archiveCatalogItem(query, user);
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
