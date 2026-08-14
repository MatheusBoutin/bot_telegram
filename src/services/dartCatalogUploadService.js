const { telegramRequest } = require("../telegram");
const { ensureGroupAdmin } = require("./adminService");

const {
  DART_RARITY_LABELS,
  DART_RARITY_EMOJIS,
} = require("../config/dartConfig");

const { parseCharacterCaption } = require("./dartCatalogParser");

const { findActiveFranchise } = require("./dartCatalogService");

const {
  getCatalogSession,
  saveCatalogSession,
  clearCatalogSession,
} = require("./dartCatalogSessionService");

function buildCharacterPreviewCaption(franchise, characterData) {
  return (
    `🎯 Prévia do personagem\n\n` +
    `Franquia: ${franchise.name}\n` +
    `Nome: ${characterData.name}\n` +
    `${DART_RARITY_EMOJIS[characterData.rarity]} ` +
    `Raridade: ` +
    `${DART_RARITY_LABELS[characterData.rarity]}\n\n` +
    `${characterData.description}\n\n` +
    `Confirme ou cancele o cadastro.`
  );
}

async function handleCatalogUpload(message, adminUser, club) {
  const session = getCatalogSession(club.id, adminUser.id);

  if (!session) {
    return false;
  }

  const commandName = message.text
    ?.trim()
    .split(/\s+/, 1)[0]
    .split("@")[0]
    .toLowerCase();

  if (commandName === "/cancelar") {
    clearCatalogSession(club.id, adminUser.id);

    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,
      text: "Cadastro de personagem cancelado.",
    });

    return true;
  }

  if (!Array.isArray(message.photo) || message.photo.length === 0) {
    return false;
  }

  const userIsStillAdmin = await ensureGroupAdmin(message);

  if (!userIsStillAdmin) {
    clearCatalogSession(club.id, adminUser.id);

    return true;
  }

  if (session.stage !== "awaiting_photo") {
    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,

      text:
        "Já existe uma prévia aguardando confirmação. " +
        "Use os botões Confirmar ou Cancelar.",
    });

    return true;
  }

  const parsedCharacter = parseCharacterCaption(message.caption);

  if (!parsedCharacter.ok) {
    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,
      text: parsedCharacter.error,
    });

    return true;
  }

  const franchise = await findActiveFranchise(club, session.franchiseId);

  if (!franchise) {
    clearCatalogSession(club.id, adminUser.id);

    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,

      text:
        "A franquia não está mais disponível. " +
        "Inicie novamente com /adicionarpersonagem.",
    });

    return true;
  }

  const bestPhoto = message.photo.at(-1);

  const characterData = {
    ...parsedCharacter,
    imageFileId: bestPhoto.file_id,
    imageUniqueId: bestPhoto.file_unique_id || null,
  };

  saveCatalogSession(club.id, adminUser.id, {
    stage: "awaiting_confirmation",
    franchiseId: franchise.id,
    characterData,
  });

  await telegramRequest("sendPhoto", {
    chat_id: message.chat.id,
    photo: characterData.imageFileId,

    caption: buildCharacterPreviewCaption(franchise, characterData),

    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "✅ Confirmar",
            callback_data: "catalog:confirm",
          },
          {
            text: "❌ Cancelar",
            callback_data: "catalog:cancel",
          },
        ],
      ],
    },
  });

  return true;
}

module.exports = {
  handleCatalogUpload,
  buildCharacterPreviewCaption,
};
