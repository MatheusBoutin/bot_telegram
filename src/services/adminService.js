const { telegramRequest } = require("../telegram");

function isGroupChat(chat) {
  return chat.type === "group" || chat.type === "supergroup";
}

async function isGroupAdmin(message) {
  const administrators = await telegramRequest("getChatAdministrators", {
    chat_id: message.chat.id,
  });

  return administrators.some((administrator) => {
    return (
      String(administrator.user.id) === String(message.from.id) &&
      ["creator", "administrator"].includes(administrator.status)
    );
  });
}

async function ensureGroupAdmin(message) {
  if (!isGroupChat(message.chat)) {
    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,
      text: "Este comando só pode ser usado dentro de um grupo.",
    });

    return false;
  }

  const userIsAdmin = await isGroupAdmin(message);

  if (!userIsAdmin) {
    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,
      text: "Somente administradores do grupo podem usar esse comando.",
    });

    return false;
  }

  return true;
}

module.exports = {
  isGroupChat,
  isGroupAdmin,
  ensureGroupAdmin,
};
