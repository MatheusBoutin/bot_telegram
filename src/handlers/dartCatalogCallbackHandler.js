const { telegramRequest } = require("../telegram");

const { isGroupAdmin } = require("../services/adminService");

const { getOrCreateUser } = require("../services/userService");

const { getOrCreateClub } = require("../services/clubService");

const {
  findActiveFranchise,
  createDartCharacter,
  listCharacters,
} = require("../services/dartCatalogService");

const {
  DART_RARITY_LABELS,
  DART_RARITY_EMOJIS,
} = require("../config/dartConfig");

const {
  saveCatalogSession,
  getCatalogSession,
  clearCatalogSession,
} = require("../services/dartCatalogSessionService");

function isCatalogCallback(callbackQuery) {
  return callbackQuery.data?.startsWith("catalog:") || false;
}

async function removeInlineKeyboard(callbackQuery) {
  if (!callbackQuery.message) {
    return;
  }

  await telegramRequest("editMessageReplyMarkup", {
    chat_id: callbackQuery.message.chat.id,

    message_id: callbackQuery.message.message_id,

    reply_markup: {
      inline_keyboard: [],
    },
  });
}

async function startCharacterUpload(callbackQuery, adminUser, club) {
  const match = callbackQuery.data.match(/^catalog:add:(\d+)$/);

  if (!match) {
    return;
  }

  const franchiseId = Number(match[1]);

  const franchise = await findActiveFranchise(club, franchiseId);

  if (!franchise) {
    await telegramRequest("sendMessage", {
      chat_id: callbackQuery.message.chat.id,

      text: "Essa franquia não está mais disponível.",
    });

    return;
  }

  saveCatalogSession(club.id, adminUser.id, {
    stage: "awaiting_photo",
    franchiseId: franchise.id,
  });

  await telegramRequest("sendMessage", {
    chat_id: callbackQuery.message.chat.id,

    text:
      `Franquia escolhida: ${franchise.name}\n\n` +
      "Agora responda a esta mensagem com a imagem " +
      "do personagem e a legenda.\n\n" +
      "Use / ou | para separar as informações:\n\n" +
      "Nome / raridade / descrição\n\n" +
      "Exemplo recomendado para celular:\n" +
      "Gimli / lendário / Filho de Glóin e membro da Sociedade do Anel.\n\n" +
      "Também funciona assim:\n" +
      "Gimli | lendário | Filho de Glóin e membro da Sociedade do Anel.\n\n" +
      "Raridades: comum, incomum, raro, épico e lendário.\n" +
      "O cadastro expira em 10 minutos. " +
      "Use /cancelar para sair.",
  });
}

async function showFranchiseCharacters(callbackQuery, club) {
  const match = callbackQuery.data.match(/^catalog:list:(\d+)$/);

  if (!match) {
    return;
  }

  const franchise = await findActiveFranchise(club, Number(match[1]));

  if (!franchise) {
    await telegramRequest("sendMessage", {
      chat_id: callbackQuery.message.chat.id,

      text: "Essa franquia não está mais disponível.",
    });

    return;
  }

  const characters = await listCharacters(franchise);

  if (characters.length === 0) {
    await telegramRequest("sendMessage", {
      chat_id: callbackQuery.message.chat.id,

      text: `A franquia ${franchise.name} ` + `ainda não possui personagens.`,
    });

    return;
  }

  const lines = characters.map((character) => {
    const status = character.active ? "" : " — desativado";

    return (
      `${DART_RARITY_EMOJIS[character.rarity]} ` +
      `${character.name} — ` +
      `${DART_RARITY_LABELS[character.rarity]}` +
      `${status}`
    );
  });

  await telegramRequest("sendMessage", {
    chat_id: callbackQuery.message.chat.id,

    text:
      `🎯 Personagens — ${franchise.name}\n\n` +
      lines.join("\n") +
      (characters.length === 20
        ? "\n\nMostrando os primeiros 20 personagens."
        : ""),
  });
}

async function confirmCharacter(callbackQuery, adminUser, club) {
  const session = getCatalogSession(club.id, adminUser.id);

  if (!session || session.stage !== "awaiting_confirmation") {
    await telegramRequest("sendMessage", {
      chat_id: callbackQuery.message.chat.id,

      text:
        "Esse cadastro expirou ou já foi finalizado. " +
        "Use /adicionarpersonagem para começar novamente.",
    });

    return;
  }

  const franchise = await findActiveFranchise(club, session.franchiseId);

  if (!franchise) {
    clearCatalogSession(club.id, adminUser.id);

    await telegramRequest("sendMessage", {
      chat_id: callbackQuery.message.chat.id,

      text: "A franquia não está mais disponível.",
    });

    return;
  }

  try {
    const character = await createDartCharacter({
      franchise,
      adminUser,
      characterData: session.characterData,
    });

    clearCatalogSession(club.id, adminUser.id);

    await removeInlineKeyboard(callbackQuery);

    await telegramRequest("sendMessage", {
      chat_id: callbackQuery.message.chat.id,

      text:
        `✅ ${character.name} foi adicionado à franquia ` +
        `${franchise.name}.`,
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      clearCatalogSession(club.id, adminUser.id);

      await removeInlineKeyboard(callbackQuery);

      await telegramRequest("sendMessage", {
        chat_id: callbackQuery.message.chat.id,

        text:
          "Já existe um personagem com esse nome nessa franquia. " +
          "Use /adicionarpersonagem para tentar novamente.",
      });

      return;
    }

    throw error;
  }
}

async function cancelCharacter(callbackQuery, adminUser, club) {
  clearCatalogSession(club.id, adminUser.id);

  await removeInlineKeyboard(callbackQuery);

  await telegramRequest("sendMessage", {
    chat_id: callbackQuery.message.chat.id,

    text: "Cadastro de personagem cancelado.",
  });
}

async function handleDartCatalogCallback(callbackQuery) {
  if (!isCatalogCallback(callbackQuery)) {
    return false;
  }

  await telegramRequest("answerCallbackQuery", {
    callback_query_id: callbackQuery.id,
  });

  if (!callbackQuery.message?.chat || !callbackQuery.from) {
    return true;
  }

  const messageContext = {
    chat: callbackQuery.message.chat,
    from: callbackQuery.from,
  };

  const userIsAdmin = await isGroupAdmin(messageContext);

  if (!userIsAdmin) {
    await telegramRequest("sendMessage", {
      chat_id: callbackQuery.message.chat.id,

      text: "Somente administradores podem usar os botões do catálogo.",
    });

    return true;
  }

  const adminUser = await getOrCreateUser(messageContext);

  const club = await getOrCreateClub(messageContext);

  if (callbackQuery.data.startsWith("catalog:add:")) {
    await startCharacterUpload(callbackQuery, adminUser, club);

    return true;
  }

  if (callbackQuery.data.startsWith("catalog:list:")) {
    await showFranchiseCharacters(callbackQuery, club);

    return true;
  }

  if (callbackQuery.data === "catalog:confirm") {
    await confirmCharacter(callbackQuery, adminUser, club);

    return true;
  }

  if (callbackQuery.data === "catalog:cancel") {
    await cancelCharacter(callbackQuery, adminUser, club);

    return true;
  }

  return true;
}

module.exports = {
  handleDartCatalogCallback,
};
