const { telegramRequest } = require("../telegram");

const { parseFranchiseName } = require("../services/dartCatalogParser");

const {
  createFranchise,
  listFranchises,
  countCharacters,
} = require("../services/dartCatalogService");

function createFranchiseKeyboard(franchises, action) {
  const rows = [];

  for (let index = 0; index < franchises.length; index += 2) {
    const row = franchises.slice(index, index + 2).map((franchise) => {
      return {
        text: franchise.name,
        callback_data: `catalog:${action}:${franchise.id}`,
      };
    });

    rows.push(row);
  }

  return {
    inline_keyboard: rows,
  };
}

async function createFranchiseCommand(message, adminUser, club) {
  const parsedFranchise = parseFranchiseName(message.text);

  if (!parsedFranchise.ok) {
    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,

      text:
        "Como usar:\n" +
        "/criarfranquia Nome da franquia\n\n" +
        parsedFranchise.error,
    });

    return;
  }

  const result = await createFranchise({
    club,
    adminUser,
    parsedFranchise,
  });

  if (!result.created) {
    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,
      text: `A franquia “${result.franchise.name}” ` + `já existe neste grupo.`,
    });

    return;
  }

  await telegramRequest("sendMessage", {
    chat_id: message.chat.id,

    text:
      `✅ Franquia “${result.franchise.name}” criada!\n\n` +
      "Agora use /adicionarpersonagem para montar o catálogo.",
  });
}

async function listFranchisesCommand(message, club) {
  const franchises = await listFranchises(club);

  if (franchises.length === 0) {
    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,

      text:
        "Nenhuma franquia foi criada neste grupo.\n\n" +
        "Use /criarfranquia Nome da franquia.",
    });

    return;
  }

  const characterCounts = await Promise.all(
    franchises.map((franchise) => {
      return countCharacters(franchise.id);
    }),
  );

  const lines = franchises.map((franchise, index) => {
    const status = franchise.active ? "ativa" : "desativada";

    const count = characterCounts[index];

    const label = count === 1 ? "personagem" : "personagens";

    return `• ${franchise.name} — ` + `${count} ${label} — ${status}`;
  });

  await telegramRequest("sendMessage", {
    chat_id: message.chat.id,

    text: `🎯 Franquias deste grupo\n\n` + lines.join("\n"),
  });
}

async function addCharacterCommand(message, club) {
  const franchises = await listFranchises(club, {
    activeOnly: true,
  });

  if (franchises.length === 0) {
    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,

      text:
        "Crie pelo menos uma franquia antes de adicionar personagens.\n\n" +
        "Use /criarfranquia Nome da franquia.",
    });

    return;
  }

  await telegramRequest("sendMessage", {
    chat_id: message.chat.id,

    text: "Escolha a franquia que receberá o personagem:",

    reply_markup: createFranchiseKeyboard(franchises, "add"),
  });
}

async function listCharactersCommand(message, club) {
  const franchises = await listFranchises(club, {
    activeOnly: true,
  });

  if (franchises.length === 0) {
    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,
      text: "Nenhuma franquia ativa foi encontrada neste grupo.",
    });

    return;
  }

  await telegramRequest("sendMessage", {
    chat_id: message.chat.id,

    text: "Escolha a franquia que deseja consultar:",

    reply_markup: createFranchiseKeyboard(franchises, "list"),
  });
}

module.exports = {
  createFranchiseCommand,
  listFranchisesCommand,
  addCharacterCommand,
  listCharactersCommand,
};
