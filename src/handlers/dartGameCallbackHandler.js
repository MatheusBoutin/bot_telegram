const { telegramRequest } = require("../telegram");
const { getOrCreateUser } = require("../services/userService");
const { consumeDart, refundDart, findPlayableFranchise, drawCharacter } = require("../services/dartGameService");
const { DART_RARITY_LABELS, DART_RARITY_EMOJIS } = require("../config/dartConfig");
const { DART_ANIMATION_DELAY_MS } = require("../config/dartGameConfig");
const { getDartGameSession, saveDartGameSession, clearDartGameSession } = require("../services/dartGameSessionService");

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const isDartGameCallback = (query) => query.data?.startsWith("darts:") || false;
function formatResultCaption(character, franchise, remaining) {
  return `🎯 Você acertou: ${character.name}\n\n📚 Franquia: ${franchise.name}\n${DART_RARITY_EMOJIS[character.rarity]} Raridade: ${DART_RARITY_LABELS[character.rarity]}\n\n${character.description}\n\n🎯 Restam ${remaining} ${remaining === 1 ? "dardo" : "dardos"} hoje.`;
}
async function sendGameResult(query, result) {
  await telegramRequest("sendDice", { chat_id: query.message.chat.id, emoji: "🎯" });
  await delay(DART_ANIMATION_DELAY_MS);
  await telegramRequest("sendPhoto", { chat_id: query.message.chat.id, photo: result.character.imageFileId, caption: formatResultCaption(result.character, result.franchise, result.remainingDarts) });
}

async function handleDartGameCallback(query) {
  if (!isDartGameCallback(query)) return false;
  await telegramRequest("answerCallbackQuery", { callback_query_id: query.id });
  if (!query.message?.chat || !query.from) return true;
  const match = query.data.match(/^darts:play:(\d+)$/);
  if (!match) return true;
  const chatId = query.message.chat.id;
  const user = await getOrCreateUser({ chat: query.message.chat, from: query.from });
  const session = getDartGameSession(chatId, user.id);
  if (!session || session.stage === "finished") {
    await telegramRequest("sendMessage", { chat_id: chatId, text: "Esse menu expirou. Use /dardos para abrir um novo sorteio." });
    return true;
  }
  if (session.stage === "resolving") return true;
  if (session.stage === "result_ready") {
    await sendGameResult(query, session.result);
    clearDartGameSession(chatId, user.id);
    return true;
  }
  const franchiseId = Number(match[1]);
  if (!session.franchiseIds.includes(franchiseId)) {
    await telegramRequest("sendMessage", { chat_id: chatId, text: "Essa franquia não faz parte deste sorteio. Use /dardos novamente." });
    return true;
  }
  saveDartGameSession(chatId, user.id, { ...session, stage: "resolving" });
  const franchise = await findPlayableFranchise(franchiseId);
  if (!franchise) {
    clearDartGameSession(chatId, user.id);
    await telegramRequest("sendMessage", { chat_id: chatId, text: "Essa franquia não possui mais personagens disponíveis. Use /dardos novamente." });
    return true;
  }
  const dartResult = await consumeDart(user);
  if (!dartResult.consumed) {
    clearDartGameSession(chatId, user.id);
    await telegramRequest("sendMessage", { chat_id: chatId, text: "🎯 Seus dardos de hoje acabaram. Volte amanhã!" });
    return true;
  }
  const character = await drawCharacter(franchise);
  if (!character) {
    await refundDart(user);
    clearDartGameSession(chatId, user.id);
    await telegramRequest("sendMessage", { chat_id: chatId, text: "Não foi possível sortear um personagem agora. Seu dardo foi devolvido; tente novamente." });
    return true;
  }
  const result = { franchise, character, remainingDarts: dartResult.remainingDarts };
  saveDartGameSession(chatId, user.id, { ...session, stage: "result_ready", result });
  await sendGameResult(query, result);
  clearDartGameSession(chatId, user.id);
  return true;
}

module.exports = { handleDartGameCallback, formatResultCaption, isDartGameCallback };
