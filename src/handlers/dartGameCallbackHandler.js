const { telegramRequest } = require("../telegram");

const { getOrCreateUser } = require("../services/userService");

const { getOrCreateClub } = require("../services/clubService");

const { getOrCreateClubMember } = require("../services/clubMemberService");

const {
  consumeDart,
  findPlayableFranchise,
  drawCharacter,
} = require("../services/dartGameService");

const {
  DART_RARITY_LABELS,
  DART_RARITY_EMOJIS,
} = require("../config/dartConfig");

const { DART_ANIMATION_DELAY_MS } = require("../config/dartGameConfig");

const {
  getDartGameSession,
  saveDartGameSession,
  clearDartGameSession,
} = require("../services/dartGameSessionService");

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function isDartGameCallback(callbackQuery) {
  return callbackQuery.data?.startsWith("darts:") || false;
}

function formatResultCaption(character, franchise, remainingDarts) {
  const dartLabel = remainingDarts === 1 ? "dardo" : "dardos";

  return (
    `🎯 Você acertou: ${character.name}\n\n` +
    `📚 Franquia: ${franchise.name}\n` +
    `${DART_RARITY_EMOJIS[character.rarity]} ` +
    `Raridade: ` +
    `${DART_RARITY_LABELS[character.rarity]}\n\n` +
    `${character.description}\n\n` +
    `🎯 Restam ${remainingDarts} ` +
    `${dartLabel} hoje.`
  );
}

async function sendGameResult(callbackQuery, result) {
  await telegramRequest("sendDice", {
    chat_id: callbackQuery.message.chat.id,
    emoji: "🎯",
  });

  await delay(DART_ANIMATION_DELAY_MS);

  await telegramRequest("sendPhoto", {
    chat_id: callbackQuery.message.chat.id,

    photo: result.character.imageFileId,

    caption: formatResultCaption(
      result.character,
      result.franchise,
      result.remainingDarts,
    ),
  });
}

async function handleDartGameCallback(callbackQuery) {
  if (!isDartGameCallback(callbackQuery)) {
    return false;
  }

  await telegramRequest("answerCallbackQuery", {
    callback_query_id: callbackQuery.id,
  });

  if (!callbackQuery.message?.chat || !callbackQuery.from) {
    return true;
  }

  const match = callbackQuery.data.match(/^darts:play:(\d+)$/);

  if (!match) {
    return true;
  }

  const messageContext = {
    chat: callbackQuery.message.chat,
    from: callbackQuery.from,
  };

  const user = await getOrCreateUser(messageContext);

  const club = await getOrCreateClub(messageContext);

  const member = await getOrCreateClubMember(user, club);

  const session = getDartGameSession(club.id, user.id);

  if (!session || session.stage === "finished") {
    await telegramRequest("sendMessage", {
      chat_id: callbackQuery.message.chat.id,

      text: "Esse menu expirou. Use /dardos para abrir um novo sorteio.",
    });

    return true;
  }

  if (session.stage === "resolving") {
    return true;
  }

  if (session.stage === "result_ready") {
    await sendGameResult(callbackQuery, session.result);

    clearDartGameSession(club.id, user.id);

    return true;
  }

  const franchiseId = Number(match[1]);

  if (!session.franchiseIds.includes(franchiseId)) {
    await telegramRequest("sendMessage", {
      chat_id: callbackQuery.message.chat.id,

      text:
        "Essa franquia não faz parte deste sorteio. " +
        "Use /dardos novamente.",
    });

    return true;
  }

  saveDartGameSession(club.id, user.id, {
    ...session,
    stage: "resolving",
  });

  const franchise = await findPlayableFranchise(club, franchiseId);

  if (!franchise) {
    clearDartGameSession(club.id, user.id);

    await telegramRequest("sendMessage", {
      chat_id: callbackQuery.message.chat.id,

      text:
        "Essa franquia não possui mais personagens disponíveis. " +
        "Use /dardos novamente.",
    });

    return true;
  }

  const dartResult = await consumeDart(member);

  if (!dartResult.consumed) {
    clearDartGameSession(club.id, user.id);

    await telegramRequest("sendMessage", {
      chat_id: callbackQuery.message.chat.id,

      text: "🎯 Seus dardos de hoje acabaram. Volte amanhã!",
    });

    return true;
  }

  const character = await drawCharacter(franchise);

  if (!character) {
    await member.increment("dartsAvailable");

    clearDartGameSession(club.id, user.id);

    await telegramRequest("sendMessage", {
      chat_id: callbackQuery.message.chat.id,

      text:
        "Não foi possível sortear um personagem agora. " +
        "Seu dardo foi devolvido; tente novamente.",
    });

    return true;
  }

  const result = {
    franchise,
    character,
    remainingDarts: dartResult.remainingDarts,
  };

  saveDartGameSession(club.id, user.id, {
    ...session,
    stage: "result_ready",
    result,
  });

  await sendGameResult(callbackQuery, result);

  clearDartGameSession(club.id, user.id);

  return true;
}

module.exports = {
  handleDartGameCallback,
  formatResultCaption,
};
