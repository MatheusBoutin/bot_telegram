const telegram = require("../telegram");
const userService = require("../services/userService");
const game = require("../services/dartGameService");
const {
  DART_RARITY_LABELS,
  DART_RARITY_EMOJIS,
} = require("../config/dartConfig");
const {
  CARD_REVEAL_DELAY_MS,
  ACERVO_BOOK_ANIMATION,
} = require("../config/dartGameConfig");
const sessions = require("../services/dartGameSessionService");
const collection = require("../services/dartCollectionService");

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const isDartGameCallback = (query) => query.data?.startsWith("darts:") || false;

function formatResultCaption(card, franchise, remaining) {
  return `✨ Você encontrou uma nova carta!\n\n🎴 ${card.name}\n\n📚 Franquia: ${franchise.name}\n${DART_RARITY_EMOJIS[card.rarity]} Raridade: ${DART_RARITY_LABELS[card.rarity]}\n\n${card.description}\n\n📖 Explorações disponíveis: ${remaining}.`;
}

function logDraw(level, context, stage, method, error, extra = {}) {
  console[level](
    JSON.stringify({
      event: "acervo_draw",
      ...context,
      stage,
      telegramMethod: method || null,
      ...extra,
      ...(error
        ? {
            code: error.code || null,
            description: telegram.redactTelegramSecrets(error),
          }
        : {}),
    }),
  );
}

function isInvalidTelegramFile(error) {
  return /wrong file identifier|wrong file identifier\/HTTP URL specified|failed to get HTTP URL content/i.test(
    error?.message || "",
  );
}

function shelfKeyboard(franchises) {
  const rows = [];
  for (let i = 0; i < franchises.length; i += 2)
    rows.push(
      franchises
        .slice(i, i + 2)
        .map(({ franchise }) => ({
          text: `📚 ${franchise.name}`,
          callback_data: `darts:play:${franchise.id}`,
        })),
    );
  return { inline_keyboard: rows };
}

function createDartGameCallbackHandler(overrides = {}) {
  const deps = {
    telegramRequest: telegram.telegramRequest,
    getOrCreateUser: userService.getOrCreateUser,
    consumeDart: game.consumeDart,
    refundDart: game.refundDart,
    findPlayableFranchise: game.findPlayableFranchise,
    getPlayableFranchises: game.getPlayableFranchises,
    drawCharacter: game.drawCharacter,
    findActiveCharacter: game.findActiveCharacter,
    registerObtainedCharacter: collection.registerObtainedCharacter,
    getDartGameSession: sessions.getDartGameSession,
    saveDartGameSession: sessions.saveDartGameSession,
    hasProcessedDartCallback: sessions.hasProcessedDartCallback,
    markDartCallbackProcessed: sessions.markDartCallbackProcessed,
    releaseDartCallback: sessions.releaseDartCallback,
    delay,
    cardRevealDelayMs: CARD_REVEAL_DELAY_MS,
    bookAnimation: ACERVO_BOOK_ANIMATION,
    ...overrides,
  };
  if (overrides.drawCharacter && !overrides.findActiveCharacter)
    deps.findActiveCharacter = null;
  const call = async (method, body, ctx, stage, warning = false) => {
    try {
      return await deps.telegramRequest(method, body);
    } catch (error) {
      logDraw(warning ? "warn" : "error", ctx, stage, method, error);
      if (!warning) throw error;
      return null;
    }
  };
  const answer = (q, ctx, text) =>
    call(
      "answerCallbackQuery",
      { callback_query_id: q.id, ...(text ? { text } : {}) },
      ctx,
      "answer",
      true,
    );
  const notify = (chatId, text, ctx, stage) =>
    call("sendMessage", { chat_id: chatId, text }, ctx, stage, true);
  const disable = (q, ctx) =>
    q.message?.message_id
      ? call(
          "editMessageReplyMarkup",
          {
            chat_id: q.message.chat.id,
            message_id: q.message.message_id,
            reply_markup: { inline_keyboard: [] },
          },
          ctx,
          "disable",
          true,
        )
      : null;

  return async function handle(query, updateContext = {}) {
    if (!isDartGameCallback(query)) return false;
    if (!query.message?.chat || !query.from) {
      await answer(
        query,
        updateContext,
        "Esta exploração não está mais disponível.",
      );
      return true;
    }
    const chatId = query.message.chat.id;
    const user = await deps.getOrCreateUser({
      chat: query.message.chat,
      from: query.from,
    });
    const ctx = {
      ...updateContext,
      callbackQueryId: query.id,
      chatId,
      userId: user.id,
      sessionKey: sessions.getSessionKey(chatId, user.id),
    };
    const session = deps.getDartGameSession(chatId, user.id);

    if (query.data === "darts:back") {
      const shelves = await deps.getPlayableFranchises();
      await answer(query, ctx);
      await call(
        "editMessageText",
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          text: "📚 Acervo Literary\n\nEscolha uma estante:",
          reply_markup: shelfKeyboard(shelves),
        },
        ctx,
        "back",
        true,
      );
      if (session)
        deps.saveDartGameSession(chatId, user.id, {
          ...session,
          stage: "ready",
        });
      return true;
    }
    const select = query.data.match(/^darts:play:(\d+)$/);
    if (select) {
      const id = Number(select[1]);
      if (!session || !session.franchiseIds.includes(id)) {
        await answer(query, ctx);
        await notify(
          chatId,
          "Esse menu expirou. Use /acervo para iniciar outra exploração.",
          ctx,
          "expired",
        );
        return true;
      }
      const franchise = await deps.findPlayableFranchise(id);
      if (!franchise) {
        await answer(query, ctx);
        await notify(
          chatId,
          "Esta estante não está mais disponível. Use /acervo para escolher outra.",
          ctx,
          "unavailable",
        );
        return true;
      }
      deps.saveDartGameSession(chatId, user.id, {
        ...session,
        stage: "shelf_selected",
        franchiseId: id,
      });
      await answer(query, ctx);
      await call(
        "sendMessage",
        {
          chat_id: chatId,
          text: `📚 Estante: ${franchise.name}\n\nUm livro chama sua atenção entre os demais.\n\nAbra-o para descobrir qual carta se esconde entre as páginas.`,
          reply_markup: {
            inline_keyboard: [
              [{ text: "📖 Abrir livro", callback_data: `darts:open:${id}` }],
              [{ text: "⬅️ Voltar às estantes", callback_data: "darts:back" }],
            ],
          },
        },
        ctx,
        "shelf",
      );
      return true;
    }
    const open = query.data.match(/^darts:open:(\d+)$/);
    if (!open) {
      await answer(query, ctx);
      return true;
    }
    if (session?.stage === "processing") {
      await answer(query, ctx, "A exploração já está em andamento.");
      return true;
    }
    if (deps.hasProcessedDartCallback(query.id)) {
      await answer(query, ctx);
      return true;
    }
    const franchiseId = Number(open[1]);
    if (
      !session ||
      session.stage !== "shelf_selected" ||
      session.franchiseId !== franchiseId
    ) {
      await answer(query, ctx);
      await notify(
        chatId,
        "Esse menu expirou. Use /acervo para iniciar outra exploração.",
        ctx,
        "expired",
      );
      return true;
    }
    const processing = {
      ...session,
      stage: "processing",
      callbackQueryId: query.id,
      consumed: false,
      refunded: false,
    };
    deps.saveDartGameSession(chatId, user.id, processing);
    deps.markDartCallbackProcessed(query.id);
    await answer(query, ctx);
    const franchise = await deps.findPlayableFranchise(franchiseId);
    if (!franchise) {
      deps.saveDartGameSession(chatId, user.id, {
        ...processing,
        stage: "failed",
      });
      await disable(query, ctx);
      await notify(
        chatId,
        "Esta estante não está mais disponível. Use /acervo para escolher outra.",
        ctx,
        "unavailable",
      );
      return true;
    }
    const consumed = await deps.consumeDart(user);
    if (!consumed.consumed) {
      deps.saveDartGameSession(chatId, user.id, {
        ...processing,
        stage: "failed",
      });
      await disable(query, ctx);
      await notify(
        chatId,
        `📚 Você não possui explorações disponíveis.\n\nNovas explorações: ${game.getRenewalCountdown()}`,
        ctx,
        "empty",
      );
      return true;
    }
    processing.consumed = true;
    deps.saveDartGameSession(chatId, user.id, processing);
    const refundOnce = async () => {
      if (processing.refunded) return;
      processing.refunded = true;
      deps.saveDartGameSession(chatId, user.id, processing);
      await deps.refundDart(user);
    };
    let card = await deps.drawCharacter(franchise);
    if (card && deps.findActiveCharacter)
      card = await deps.findActiveCharacter(card.id, franchise.id);
    if (!card) {
      await refundOnce();
      deps.saveDartGameSession(chatId, user.id, {
        ...processing,
        stage: "failed",
      });
      await disable(query, ctx);
      await notify(
        chatId,
        "A carta deixou de estar disponível. Sua exploração foi devolvida; use /acervo novamente.",
        ctx,
        "card_unavailable",
      );
      return true;
    }
    if (deps.bookAnimation) {
      const animation = await call(
        "sendAnimation",
        { chat_id: chatId, animation: deps.bookAnimation },
        ctx,
        "animation",
        true,
      );
      if (!animation) await notify(chatId, "📖", ctx, "animation_fallback");
    } else {
      logDraw("warn", ctx, "animation_not_configured", "sendAnimation", null);
      await notify(chatId, "📖", ctx, "animation_fallback");
    }
    await deps.delay(deps.cardRevealDelayMs);
    try {
      await call(
        "sendPhoto",
        {
          chat_id: chatId,
          photo: card.imageFileId,
          caption: formatResultCaption(
            card,
            franchise,
            consumed.remainingDarts,
          ),
        },
        ctx,
        "reveal",
      );
    } catch (error) {
      await refundOnce();
      deps.saveDartGameSession(chatId, user.id, {
        ...processing,
        stage: "failed",
        characterId: card.id,
      });
      await disable(query, ctx);
      await notify(
        chatId,
        "Não consegui revelar esta carta. Sua exploração foi devolvida uma vez.",
        ctx,
        "reveal_failed",
      );
      return true;
    }
    try {
      const entry = await deps.registerObtainedCharacter({
        userId: user.id,
        characterId: card.id,
      });
      const quantity = Number(entry?.quantity || 1);
      await notify(
        chatId,
        quantity > 1
          ? `📚 Esta carta já fazia parte da sua coleção.\n\nAgora você possui ${quantity} cópias.`
          : "✨ Nova descoberta!\n\nEsta carta foi adicionada à sua /colecao.",
        ctx,
        "collection_result",
      );
    } catch (error) {
      logDraw("error", ctx, "collection", null, error, {
        characterId: card.id,
      });
      await notify(
        chatId,
        "Sua carta foi enviada, mas houve uma falha ao registrá-la na coleção.",
        ctx,
        "collection_failed",
      );
    }
    deps.saveDartGameSession(chatId, user.id, {
      ...processing,
      stage: "completed",
      characterId: card.id,
    });
    await disable(query, ctx);
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
