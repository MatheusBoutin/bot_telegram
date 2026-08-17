const { telegramRequest } = require("../telegram");
const { getOrCreateUser } = require("../services/userService");
const { canManageBot } = require("../services/botAdminService");
const { findActiveFranchise, createDartCharacter, listCharacters } = require("../services/dartCatalogService");
const { DART_RARITY_LABELS, DART_RARITY_EMOJIS } = require("../config/dartConfig");
const { saveCatalogSession, getCatalogSession, clearCatalogSession } = require("../services/dartCatalogSessionService");

const isCatalogCallback = (query) => query.data?.startsWith("catalog:") || false;
async function removeKeyboard(query) {
  await telegramRequest("editMessageReplyMarkup", { chat_id: query.message.chat.id, message_id: query.message.message_id, reply_markup: { inline_keyboard: [] } });
}
async function startUpload(query, user) {
  const match = query.data.match(/^catalog:add:(\d+)$/);
  if (!match) return;
  const franchise = await findActiveFranchise(Number(match[1]));
  if (!franchise) return telegramRequest("sendMessage", { chat_id: query.message.chat.id, text: "Essa franquia não está mais disponível." });
  saveCatalogSession(query.message.chat.id, user.id, { stage: "awaiting_photo", franchiseId: franchise.id });
  await telegramRequest("sendMessage", {
    chat_id: query.message.chat.id,
    text: `Franquia escolhida: ${franchise.name}\n\nAgora envie a imagem do personagem com a legenda:\nNome / raridade / descrição\n\nRaridades: comum, incomum, raro, épico e lendário.\nO cadastro expira em 10 minutos. Use /cancelar para sair.`,
  });
}
async function showCharacters(query) {
  const match = query.data.match(/^catalog:list:(\d+)$/);
  if (!match) return;
  const franchise = await findActiveFranchise(Number(match[1]));
  if (!franchise) return telegramRequest("sendMessage", { chat_id: query.message.chat.id, text: "Essa franquia não está mais disponível." });
  const characters = await listCharacters(franchise);
  const text = characters.length
    ? `🎯 Personagens — ${franchise.name}\n\n${characters.map((character) => `${DART_RARITY_EMOJIS[character.rarity]} ${character.name} — ${DART_RARITY_LABELS[character.rarity]}${character.active ? "" : " — desativado"}`).join("\n")}${characters.length === 20 ? "\n\nMostrando os primeiros 20 personagens." : ""}`
    : `A franquia ${franchise.name} ainda não possui personagens.`;
  await telegramRequest("sendMessage", { chat_id: query.message.chat.id, text });
}
async function confirm(query, user) {
  const chatId = query.message.chat.id;
  const session = getCatalogSession(chatId, user.id);
  if (!session || session.stage !== "awaiting_confirmation") return telegramRequest("sendMessage", { chat_id: chatId, text: "Esse cadastro expirou ou já foi finalizado. Use /adicionarpersonagem novamente." });
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
    await telegramRequest("sendMessage", { chat_id: chatId, text: `✅ ${character.name} foi adicionado à franquia ${franchise.name}.` });
  } catch (error) {
    if (error.name !== "SequelizeUniqueConstraintError") throw error;
    clearCatalogSession(chatId, user.id);
    await removeKeyboard(query);
    await telegramRequest("sendMessage", { chat_id: chatId, text: "Já existe um personagem com esse nome nessa franquia. Use /adicionarpersonagem novamente." });
  }
}

async function handleDartCatalogCallback(query) {
  if (!isCatalogCallback(query)) return false;
  await telegramRequest("answerCallbackQuery", { callback_query_id: query.id });
  if (!query.message?.chat || !query.from) return true;
  const chatId = query.message.chat.id;
  const user = await getOrCreateUser({ chat: query.message.chat, from: query.from });
  if (!(await canManageBot(user))) {
    clearCatalogSession(chatId, user.id);
    await telegramRequest("sendMessage", { chat_id: chatId, text: "Este botão exige acesso de administrador global do bot." });
    return true;
  }
  if (query.data.startsWith("catalog:add:")) await startUpload(query, user);
  else if (query.data.startsWith("catalog:list:")) await showCharacters(query);
  else if (query.data === "catalog:confirm") await confirm(query, user);
  else if (query.data === "catalog:cancel") {
    clearCatalogSession(chatId, user.id);
    await removeKeyboard(query);
    await telegramRequest("sendMessage", { chat_id: chatId, text: "Cadastro de personagem cancelado." });
  }
  return true;
}

module.exports = { handleDartCatalogCallback, isCatalogCallback };
