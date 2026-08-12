const { Club } = require("../database/models");

function getTelegramChatName(chat) {
  if (chat.title) {
    return chat.title;
  }

  const privateChatName = [chat.first_name, chat.last_name]
    .filter(Boolean)
    .join(" ");

  if (privateChatName) {
    return privateChatName;
  }

  if (chat.username) {
    return chat.username;
  }

  return `Chat ${chat.id}`;
}

async function getOrCreateClub(message) {
  const telegramChatId = String(message.chat.id);
  const name = getTelegramChatName(message.chat);
  const type = message.chat.type || "unknown";

  const [club, created] = await Club.findOrCreate({
    where: {
      telegramChatId: telegramChatId,
    },

    defaults: {
      name: name,
      type: type,
    },
  });

  if (created) {
    console.log(`Novo clube criado: ${club.name}`);
    return club;
  }

  let changed = false;

  if (club.name !== name) {
    club.name = name;
    changed = true;
  }

  if (club.type !== type) {
    club.type = type;
    changed = true;
  }

  if (changed) {
    await club.save();
  }

  return club;
}

module.exports = {
  getOrCreateClub,
};
