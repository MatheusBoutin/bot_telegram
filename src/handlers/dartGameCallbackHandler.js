const telegram = require("../telegram");
const userService = require("../services/userService");
const dartGameService = require("../services/dartGameService");
const { DART_RARITY_LABELS, DART_RARITY_EMOJIS } = require("../config/dartConfig");
const { DART_ANIMATION_DELAY_MS } = require("../config/dartGameConfig");
const sessions = require("../services/dartGameSessionService");
const collectionService = require("../services/dartCollectionService");

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const isDartGameCallback = (query) => query.data?.startsWith("darts:") || false;

function formatResultCaption(character, franchise, remaining) {
  return `🎯 Você acertou: ${character.name}\n\n📚 Franquia: ${franchise.name}\n${DART_RARITY_EMOJIS[character.rarity]} Raridade: ${DART_RARITY_LABELS[character.rarity]}\n\n${character.description}\n\n🎯 Restam ${remaining} ${remaining === 1 ? "dardo" : "dardos"} hoje.`;
}

function errorDetails(error) {
  return { code: error?.code || null, description: telegram.redactTelegramSecrets(error) };
}

function logDraw(level, context, stage, method, error, extra = {}) {
  console[level](JSON.stringify({
    event: "dart_draw",
    updateId: context.updateId ?? null,
    callbackQueryId: context.callbackQueryId ?? null,
    chatId: context.chatId ?? null,
    userId: context.userId ?? null,
    sessionKey: context.sessionKey ?? null,
    stage,
    telegramMethod: method || null,
    ...extra,
    ...(error ? errorDetails(error) : {}),
  }));
}

function isInvalidTelegramFile(error) {
  return /wrong file identifier|wrong file identifier\/HTTP URL specified|failed to get HTTP URL content/i
    .test(error?.message || "");
}

function createDartGameCallbackHandler(overrides = {}) {
  const deps = {
    telegramRequest: telegram.telegramRequest,
    getOrCreateUser: userService.getOrCreateUser,
    consumeDart: dartGameService.consumeDart,
    refundDart: dartGameService.refundDart,
    findPlayableFranchise: dartGameService.findPlayableFranchise,
    drawCharacter: dartGameService.drawCharacter,
    registerObtainedCharacter: collectionService.registerObtainedCharacter,
    getDartGameSession: sessions.getDartGameSession,
    saveDartGameSession: sessions.saveDartGameSession,
    hasProcessedDartCallback: sessions.hasProcessedDartCallback,
    markDartCallbackProcessed: sessions.markDartCallbackProcessed,
    releaseDartCallback: sessions.releaseDartCallback,
    wait: delay,
    animationDelayMs: DART_ANIMATION_DELAY_MS,
    ...overrides,
  };

  async function telegramCall(method, body, drawContext, stage, { warning = false } = {}) {
    try {
      return await deps.telegramRequest(method, body);
    } catch (error) {
      logDraw(warning ? "warn" : "error", drawContext, stage, method, error);
      if (!warning) throw error;
      return null;
    }
  }

  async function answer(query, drawContext, text) {
    const body = { callback_query_id: query.id };
    if (text) body.text = text;
    await telegramCall("answerCallbackQuery", body, drawContext, "callback_answer", { warning: true });
  }

  async function disableButtons(query, drawContext) {
    if (!query.message?.message_id) return;
    await telegramCall("editMessageReplyMarkup", {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      reply_markup: { inline_keyboard: [] },
    }, drawContext, "disable_buttons", { warning: true });
  }

  async function notify(chatId, text, drawContext, stage) {
    await telegramCall("sendMessage", { chat_id: chatId, text }, drawContext, stage, { warning: true });
  }

  return async function handleDartGameCallback(query, updateContext = {}) {
    if (!isDartGameCallback(query)) return false;
    if (!query.message?.chat || !query.from) {
      await answer(query, { ...updateContext, callbackQueryId: query.id }, "Este sorteio não está mais disponível.");
      return true;
    }

    const match = query.data.match(/^darts:play:(\d+)$/);
    const chatId = query.message.chat.id;
    const baseContext = { ...updateContext, callbackQueryId: query.id, chatId, userId: query.from.id };
    if (!match) {
      await answer(query, baseContext);
      return true;
    }
    if (deps.hasProcessedDartCallback(query.id)) {
      logDraw("warn", baseContext, "duplicate_callback", null, null);
      await answer(query, baseContext);
      return true;
    }

    const user = await deps.getOrCreateUser({ chat: query.message.chat, from: query.from });
    const drawContext = {
      ...baseContext,
      userId: user.id,
      sessionKey: sessions.getSessionKey(chatId, user.id),
    };
    const session = deps.getDartGameSession(chatId, user.id);
    if (session?.stage === "processing") {
      await answer(query, drawContext, "O sorteio já está em andamento.");
      return true;
    }
    if (!session || session.stage === "completed" || session.stage === "failed") {
      await answer(query, drawContext);
      await notify(chatId, "Esse menu expirou. Use /dardos para abrir um novo sorteio.", drawContext, "expired_session");
      return true;
    }

    const franchiseId = Number(match[1]);
    if (session.stage !== "ready" && session.stage !== "choosing_franchise") {
      await answer(query, drawContext);
      return true;
    }
    if (!session.franchiseIds.includes(franchiseId)) {
      await answer(query, drawContext);
      await notify(chatId, "Essa franquia não faz parte deste sorteio. Use /dardos novamente.", drawContext, "invalid_franchise");
      return true;
    }

    const processingSession = {
      ...session,
      stage: "processing",
      callbackQueryId: query.id,
      consumed: false,
      refunded: false,
    };
    deps.saveDartGameSession(chatId, user.id, processingSession);
    deps.markDartCallbackProcessed(query.id);
    logDraw("log", drawContext, "processing", null, null);
    await answer(query, drawContext);

    let franchise;
    try {
      franchise = await deps.findPlayableFranchise(franchiseId);
    } catch (error) {
      deps.saveDartGameSession(chatId, user.id, session);
      deps.releaseDartCallback(query.id);
      logDraw("error", drawContext, "find_franchise", null, error);
      throw error;
    }
    if (!franchise) {
      deps.saveDartGameSession(chatId, user.id, { ...processingSession, stage: "failed" });
      await disableButtons(query, drawContext);
      await notify(chatId, "Essa franquia não possui mais personagens disponíveis. Use /dardos novamente.", drawContext, "franchise_unavailable");
      return true;
    }

    let dartResult;
    try {
      dartResult = await deps.consumeDart(user);
    } catch (error) {
      deps.saveDartGameSession(chatId, user.id, session);
      deps.releaseDartCallback(query.id);
      logDraw("error", drawContext, "consume", null, error);
      throw error;
    }
    if (!dartResult.consumed) {
      deps.saveDartGameSession(chatId, user.id, { ...processingSession, stage: "failed" });
      await disableButtons(query, drawContext);
      await notify(chatId, "🎯 Seus dardos de hoje acabaram. Volte amanhã!", drawContext, "no_darts");
      return true;
    }
    processingSession.consumed = true;
    deps.saveDartGameSession(chatId, user.id, processingSession);

    const refundOnce = async (stage) => {
      if (!processingSession.consumed || processingSession.refunded) return true;
      processingSession.refunded = true;
      deps.saveDartGameSession(chatId, user.id, processingSession);
      try {
        await deps.refundDart(user);
        logDraw("log", drawContext, stage, null, null, { refunded: true });
        return true;
      } catch (error) {
        logDraw("error", drawContext, "refund", null, error, { requiresManualRefund: true });
        return false;
      }
    };

    let character;
    try {
      character = await deps.drawCharacter(franchise);
    } catch (error) {
      logDraw("error", drawContext, "draw_character", null, error);
    }
    if (!character) {
      const refunded = await refundOnce("draw_failed");
      deps.saveDartGameSession(chatId, user.id, { ...processingSession, stage: "failed" });
      await disableButtons(query, drawContext);
      await notify(chatId, refunded
        ? "Não foi possível sortear um personagem agora. Seu dardo foi devolvido; tente novamente."
        : "Não foi possível sortear um personagem, e a devolução falhou. O erro foi registrado para correção.",
      drawContext, "draw_failed_notification");
      return true;
    }

    const animation = await telegramCall("sendDice", { chat_id: chatId, emoji: "🎯" }, drawContext, "animation", { warning: true });
    if (animation) await deps.wait(deps.animationDelayMs);
    try {
      await telegramCall("sendPhoto", {
        chat_id: chatId,
        photo: character.imageFileId,
        caption: formatResultCaption(character, franchise, dartResult.remainingDarts),
      }, drawContext, "reveal");
    } catch (error) {
      logDraw("error", drawContext, "reveal_failed", "sendPhoto", error, {
        characterId: character.id,
        invalidFileId: isInvalidTelegramFile(error),
        imageReferenceType: /^https?:\/\//i.test(character.imageFileId) ? "url" : "telegram_file_id",
      });
      const refunded = await refundOnce("reveal_failed");
      deps.saveDartGameSession(chatId, user.id, { ...processingSession, stage: "failed", characterId: character.id });
      await disableButtons(query, drawContext);
      await notify(chatId, refunded
        ? "Não consegui revelar esta carta. Sua tentativa foi devolvida. Tente novamente mais tarde."
        : "Não consegui revelar esta carta, e a devolução falhou. O erro foi registrado para correção.",
      drawContext, "reveal_failed_notification");
      return true;
    }

    try {
      await deps.registerObtainedCharacter({ userId: user.id, characterId: character.id });
    } catch (error) {
      logDraw("error", drawContext, "collection", null, error, { characterId: character.id });
      await notify(chatId,
        "Sua carta foi enviada, mas houve uma falha ao registrá-la na coleção. O erro foi registrado para correção.",
        drawContext, "collection_failed_notification");
    }
    deps.saveDartGameSession(chatId, user.id, {
      ...processingSession,
      stage: "completed",
      characterId: character.id,
    });
    logDraw("log", drawContext, "completed", null, null, { characterId: character.id });
    return true;
  };
}

const handleDartGameCallback = createDartGameCallbackHandler();

module.exports = {
  handleDartGameCallback,
  createDartGameCallbackHandler,
  formatResultCaption,
  isDartGameCallback,
  isInvalidTelegramFile,
};
