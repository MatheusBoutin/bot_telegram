const { telegramRequest } = require("../telegram");

const HELP_COMMANDS = new Set(["/ajuda", "/help", "/start"]);

const HELP_TEXT = `

✨ Como ganhar XP
Participe normalmente das conversas do grupo. Mensagens válidas podem entregar XP e aumentar seu nível.

Mensagens muito curtas, repetidas ou enviadas rapidamente podem não entregar XP. Use /statusxp para consultar as regras completas.

 Perfil
/literaryxp — mostra seu XP, nível, título e quantidade de mensagens.

/literaryxp respondendo a alguém — mostra o perfil dessa pessoa no grupo.

 Ranking
/rank — mostra os membros com mais XP no grupo.

 Regras de XP
/statusxp — explica quanto XP pode ser recebido e quais mensagens são consideradas válidas.

 Cada grupo possui seu próprio XP, perfil e ranking.`;

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
