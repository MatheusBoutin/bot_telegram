const { telegramRequest } = require("../telegram");

const HELP_COMMANDS = new Set(["/ajuda", "/help", "/start"]);

const HELP_TEXT = `✨ Guia de comandos

/literaryxp — mostra seu XP, nível e título

/rank — mostra o ranking de XP do grupo

/colecao — mostra as cartas que você já encontrou

/statusxp — explica como o sistema de XP funciona

/admliterary — mostra os administradores

/ajuda — abre este guia`;

function isHelpCommand(commandName) {
  return HELP_COMMANDS.has(commandName);
}

async function helpCommand(message) {
  await telegramRequest("sendMessage", {
    chat_id: message.chat.id,
    text: HELP_TEXT,
  });
}

module.exports = {
  HELP_TEXT,
  helpCommand,
  isHelpCommand,
};
