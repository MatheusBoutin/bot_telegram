const { telegramRequest } = require("../telegram");

const HELP_COMMANDS = new Set(["/ajuda", "/help", "/start"]);

const HELP_TEXT = `✨ Guia de comandos

/acervo — explore as estantes e encontre novas cartas
Você recebe três explorações por dia. As explorações não utilizadas ficam acumuladas.

/colecao — veja as cartas que você já encontrou

/literaryxp — mostra seu XP, nível e título

/rank — mostra o ranking de XP do grupo

/statusxp — mostra as regras de XP

/admliterary — mostra os administradores do bot

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
