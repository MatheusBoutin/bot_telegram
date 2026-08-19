const telegram = require("../telegram");
const { resolveGlobalManager } = require("./changeBotPhotoCommand");

const UNAUTHORIZED_MESSAGE = "Você não tem permissão para alterar o nome do bot.";
const USAGE_MESSAGE = "Uso: /trocarnome novo nome\n\nExemplo:\n/trocarnome Literary Club";
const reply = (message, text) => telegram.telegramRequest("sendMessage", { chat_id: message.chat.id, text });

function parseBotName(text) {
  if (typeof text !== "string") return { ok: false, reason: "missing" };
  const match = text.match(/^\/trocarnome(?:@[^\s]+)?(?:[ \t]+([\s\S]*))?$/i);
  if (!match || match[1] === undefined) return { ok: false, reason: "missing" };
  if (/\r|\n/.test(match[1])) return { ok: false, reason: "newline" };

  const name = match[1].trim();
  if (!name) return { ok: false, reason: "missing" };
  if (Array.from(name).length > 64) return { ok: false, reason: "too_long" };
  return { ok: true, name };
}

async function changeBotNameCommand(message) {
  if (message.chat.type !== "private") return reply(message, "Use este comando no privado do bot.");

  let actor = await resolveGlobalManager(message);
  if (!actor) return reply(message, UNAUTHORIZED_MESSAGE);

  const parsed = parseBotName(message.text);
  if (!parsed.ok) {
    if (parsed.reason === "too_long") return reply(message, "O nome do bot pode ter no máximo 64 caracteres.");
    return reply(message, USAGE_MESSAGE);
  }

  try {
    actor = await resolveGlobalManager(message);
    if (!actor) return reply(message, UNAUTHORIZED_MESSAGE);
    await telegram.telegramRequest("setMyName", { name: parsed.name });
    return reply(message, `✅ Nome do bot atualizado para: ${parsed.name}`);
  } catch (error) {
    console.error("Falha ao atualizar nome do bot:", telegram.redactTelegramSecrets(error));
    return reply(message, "Não foi possível atualizar o nome do bot. Tente novamente.");
  } finally {
    actor = null;
  }
}

module.exports = { changeBotNameCommand, parseBotName, UNAUTHORIZED_MESSAGE, USAGE_MESSAGE };
