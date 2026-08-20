const { telegramRequest } = require("../telegram");
const { getOrCreateUser } = require("../services/userService");
const { consumeDart, refundDart, findPlayableFranchise, drawCharacter } = require("../services/dartGameService");
const { DART_RARITY_LABELS, DART_RARITY_EMOJIS } = require("../config/dartConfig");
const { DART_ANIMATION_DELAY_MS } = require("../config/dartGameConfig");
const { getDartGameSession, saveDartGameSession, clearDartGameSession } = require("../services/dartGameSessionService");
const { registerObtainedCharacter } = require("../services/dartCollectionService");

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
    clearDartGameSession(chatId, user.id);
    await telegramRequest("sendMessage", { chat_id: chatId, text: "Esse sorteio expirou. Use /dardos para jogar novamente." });
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
  try {
    await sendGameResult(query, result);
  } catch (error) {
    await refundDart(user);
    clearDartGameSession(chatId, user.id);
    console.error("Falha ao enviar carta dos dardos; dardo devolvido:", error);
    try {
      await telegramRequest("sendMessage", { chat_id: chatId, text: "Não foi possível enviar sua carta. Seu dardo foi devolvido; tente novamente." });
    } catch (notificationError) {
      console.error("Falha ao avisar sobre devolução do dardo:", notificationError);
    }
    return true;
  }
  try {
    await registerObtainedCharacter({ userId: user.id, characterId: character.id });
  } catch (error) {
    console.error("Carta enviada, mas não foi possível registrar a coleção:", error);
    try {
      await telegramRequest("sendMessage", {
        chat_id: chatId,
        text: "Sua carta foi enviada, mas houve uma falha ao registrá-la na coleção. O erro foi registrado para correção.",
      });
    } catch (notificationError) {
      console.error("Falha ao avisar sobre erro da coleção:", notificationError);
    }
  }
  clearDartGameSession(chatId, user.id);
  return true;
}

module.exports = { handleDartGameCallback, formatResultCaption, isDartGameCallback };
