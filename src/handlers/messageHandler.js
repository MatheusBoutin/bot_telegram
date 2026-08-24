const { telegramRequest } = require("../telegram");
const { profileCommand } = require("../commands/profileCommand");
const { rankCommand } = require("../commands/rankCommand");
const { acervoCommand, privateOnlyAcervoNotice } = require("../commands/dartsCommand");
const { collectionCommand } = require("../commands/collectionCommand");
const { grantXpCommand } = require("../commands/grantXpCommand");
const { adjustXpCommand } = require("../commands/adjustXpCommand");
const { xpHistoryCommand } = require("../commands/xpHistoryCommand");
const { undoXpCommand } = require("../commands/undoXpCommand");
const { adminHelpCommand } = require("../commands/adminHelpCommand.js");
const { xpStatusCommand } = require("../commands/xpStatusCommand");
const { helpCommand, isHelpCommand } = require("../commands/helpCommand");
const { createFranchiseCommand, deleteFranchiseCommand, deleteCharacterCommand, listFranchisesCommand, addCharacterCommand, listCharactersCommand } = require("../commands/dartCatalogCommand");
const { meuidCommand, grantAdminCommand, removeAdminCommand, listAdminsCommand } = require("../commands/botAdminCommand");
const { changeBotPhotoCommand } = require("../commands/changeBotPhotoCommand");
const { changeBotNameCommand } = require("../commands/changeBotNameCommand");
const { getUnlockedTitle } = require("../services/titleService");
const { getOrCreateUser } = require("../services/userService");
const { getOrCreateClub } = require("../services/clubService");
const { getOrCreateClubMember } = require("../services/clubMemberService");
const { getCommandName, getCommandArguments } = require("../services/commandService");
const { isGroupChat } = require("../services/adminService");
const { canManageBot } = require("../services/botAdminService");
const { handleCatalogUpload } = require("../services/dartCatalogUploadService");
const { isValidXpMessage, canGainXp, addXp } = require("../services/xpService");

const catalogCommands = new Set(["/criarfranquia", "/excluirfranquia", "/excluircarta", "/franquias", "/adicionarcarta", "/adicionarpersonagem", "/cartas", "/personagens"]);
const privateCatalogCommands = new Set(["/excluirfranquia", "/excluircarta", "/adicionarcarta", "/adicionarpersonagem", "/cartas", "/personagens"]);
const globalAdminCommands = new Set(["/darxp", "/ajustarxp", "/historico", "/desfazerxp", "/comandosadm"]);

async function ensureGlobalAdmin(message, user) {
  if (await canManageBot(user)) return true;
  await telegramRequest("sendMessage", {
    chat_id: message.chat.id,
    text: "Somente o owner e administradores globais do bot podem usar este comando.",
  });
  return false;
}

async function handleCatalogCommand(message, user, commandName) {
  if (privateCatalogCommands.has(commandName) && message.chat.type !== "private") {
    await telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Este comando administrativo funciona somente no privado." });
    return;
  }
  if (!(await canManageBot(user))) {
    await telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Somente o owner e administradores globais podem administrar o catálogo." });
    return;
  }
  if (commandName === "/criarfranquia") await createFranchiseCommand(message, user);
  else if (commandName === "/excluirfranquia") await deleteFranchiseCommand(message, user);
  else if (commandName === "/excluircarta") await deleteCharacterCommand(message, user);
  else if (commandName === "/franquias") await listFranchisesCommand(message);
  else if (["/adicionarcarta", "/adicionarpersonagem"].includes(commandName)) await addCharacterCommand(message);
  else if (["/cartas", "/personagens"].includes(commandName)) await listCharactersCommand(message);
}

async function handleMessage(message) {
  if (!message.from || message.from.is_bot) return;
  const commandName = getCommandName(message.text) || getCommandName(message.caption);
  const commandArguments = getCommandArguments(message.text || message.caption);

  if (["/acervo", "/dardos"].includes(commandName) && message.chat.type !== "private") {
    return privateOnlyAcervoNotice(message);
  }
  if (commandName === "/start" && commandArguments[0]?.toLowerCase() === "acervo" && message.chat.type === "private") {
    return startAcervoCommand(message);
  }

  if (isHelpCommand(commandName)) return helpCommand(message);
  if (commandName === "/trocarfoto") return changeBotPhotoCommand(message);
  if (commandName === "/trocarnome") return changeBotNameCommand(message);
  if (commandName === "/admliterary") return listAdminsCommand(message);

  const user = await getOrCreateUser(message);

  if (commandName === "/meuid") return meuidCommand(message);
  if (commandName === "/daradmin") return grantAdminCommand(message, user);
  if (commandName === "/removeradmin") return removeAdminCommand(message, user);
  if (catalogCommands.has(commandName)) return handleCatalogCommand(message, user, commandName);

  if (await handleCatalogUpload(message, user)) return;
  if (["/acervo", "/dardos"].includes(commandName)) return acervoCommand(message, user);
  if (commandName === "/colecao") return collectionCommand(message, user);

  // Tudo abaixo é deliberadamente específico de grupo.
  if (!isGroupChat(message.chat)) return;
  const club = await getOrCreateClub(message);
  if (commandName === "/statusxp") return xpStatusCommand(message, club);
  const member = await getOrCreateClubMember(user, club);

  if (globalAdminCommands.has(commandName)) {
    if (!(await ensureGlobalAdmin(message, user))) return;
    if (commandName === "/darxp") await grantXpCommand(message, user, club);
    else if (commandName === "/ajustarxp") await adjustXpCommand(message, user, club);
    else if (commandName === "/historico") await xpHistoryCommand(message, club);
    else if (commandName === "/desfazerxp") await undoXpCommand(message, user, club);
    else if (commandName === "/comandosadm") await adminHelpCommand(message);
    return;
  }
  if (commandName === "/literaryxp") return profileCommand(message, user, member, club);
  if (commandName === "/rank") return rankCommand(message, club);
  if (commandName) return;
  if (!isValidXpMessage(message, member) || !canGainXp(member)) return;
  const result = await addXp(member, message);
  console.log(`${user.name} ganhou ${result.xpGained} XP em ${club.name}. Total: ${member.xp}`);
  if (result.leveledUp) {
    const newTitle = getUnlockedTitle(result.previousLevel, member.level);
    let text = `🎉 ${user.name} subiu de nível!\n\n⭐ Novo nível: ${member.level}`;
    if (newTitle) text += `\n\n🏷️ Novo título desbloqueado:\n${newTitle}`;
    await telegramRequest("sendMessage", { chat_id: message.chat.id, text });
  }
}

async function startAcervoCommand(message) {
  const user = await getOrCreateUser(message);
  return acervoCommand(message, user);
}

module.exports = { handleMessage, handleCatalogCommand, ensureGlobalAdmin };
