const { telegramRequest } = require("../telegram");
const { profileCommand } = require("../commands/profileCommand");
const { rankCommand } = require("../commands/rankCommand");
const { dartsCommand } = require("../commands/dartsCommand");
const { grantXpCommand } = require("../commands/grantXpCommand");
const { adjustXpCommand } = require("../commands/adjustXpCommand");
const { xpHistoryCommand } = require("../commands/xpHistoryCommand");
const { undoXpCommand } = require("../commands/undoXpCommand");
const { adminHelpCommand } = require("../commands/adminHelpCommand.js");
const { xpStatusCommand } = require("../commands/xpStatusCommand");
const { helpCommand, isHelpCommand } = require("../commands/helpCommand");
const { createFranchiseCommand, listFranchisesCommand, addCharacterCommand, listCharactersCommand } = require("../commands/dartCatalogCommand");
const { meuidCommand, grantAdminCommand, removeAdminCommand, listAdminsCommand } = require("../commands/botAdminCommand");
const { changeBotPhotoCommand } = require("../commands/changeBotPhotoCommand");
const { getTitle } = require("../services/titleService");
const { getOrCreateUser } = require("../services/userService");
const { getOrCreateClub } = require("../services/clubService");
const { getOrCreateClubMember } = require("../services/clubMemberService");
const { getCommandName } = require("../services/commandService");
const { ensureGroupAdmin, isGroupChat } = require("../services/adminService");
const { canManageBot } = require("../services/botAdminService");
const { handleCatalogUpload } = require("../services/dartCatalogUploadService");
const { isValidXpMessage, canGainXp, addXp } = require("../services/xpService");

const catalogCommands = new Set(["/criarfranquia", "/franquias", "/adicionarpersonagem", "/personagens"]);
const groupAdminCommands = new Set(["/darxp", "/ajustarxp", "/historico", "/desfazerxp", "/comandosadm", "/statusxp"]);

async function handleCatalogCommand(message, user, commandName) {
  if (!(await canManageBot(user))) {
    await telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Somente o owner e administradores globais podem administrar o catálogo." });
    return;
  }
  if (commandName === "/criarfranquia") await createFranchiseCommand(message, user);
  else if (commandName === "/franquias") await listFranchisesCommand(message);
  else if (commandName === "/adicionarpersonagem") await addCharacterCommand(message);
  else if (commandName === "/personagens") await listCharactersCommand(message);
}

async function handleMessage(message) {
  if (!message.from || message.from.is_bot) return;
  const commandName = getCommandName(message.text) || getCommandName(message.caption);

  if (isHelpCommand(commandName)) return helpCommand(message);
  if (commandName === "/trocarfoto") return changeBotPhotoCommand(message);

  const user = await getOrCreateUser(message);

  if (commandName === "/meuid") return meuidCommand(message);
  if (commandName === "/daradmin") return grantAdminCommand(message, user);
  if (commandName === "/removeradmin") return removeAdminCommand(message, user);
  if (commandName === "/admins") return listAdminsCommand(message, user);
  if (catalogCommands.has(commandName)) return handleCatalogCommand(message, user, commandName);

  if (await handleCatalogUpload(message, user)) return;
  if (commandName === "/dardos") return dartsCommand(message, user);

  // Tudo abaixo é deliberadamente específico de grupo.
  if (!isGroupChat(message.chat)) return;
  const club = await getOrCreateClub(message);
  const member = await getOrCreateClubMember(user, club);

  if (groupAdminCommands.has(commandName)) {
    if (!(await ensureGroupAdmin(message))) return;
    if (commandName === "/darxp") await grantXpCommand(message, user, club);
    else if (commandName === "/ajustarxp") await adjustXpCommand(message, user, club);
    else if (commandName === "/historico") await xpHistoryCommand(message, club);
    else if (commandName === "/desfazerxp") await undoXpCommand(message, user, club);
    else if (commandName === "/comandosadm") await adminHelpCommand(message);
    else if (commandName === "/statusxp") await xpStatusCommand(message, club);
    return;
  }
  if (commandName === "/literaryxp") return profileCommand(message, user, member, club);
  if (commandName === "/rank") return rankCommand(message, club);
  if (commandName) return;
  if (!isValidXpMessage(message, member) || !canGainXp(member)) return;
  const result = await addXp(member, message);
  console.log(`${user.name} ganhou ${result.xpGained} XP em ${club.name}. Total: ${member.xp}`);
  if (result.leveledUp) {
    const oldTitle = getTitle(result.previousLevel);
    const newTitle = getTitle(member.level);
    let text = `🎉 ${user.name} subiu de nível!\n\n⭐ Novo nível: ${member.level}`;
    if (oldTitle !== newTitle) text += `\n\n🏷️ Novo título desbloqueado:\n${newTitle}`;
    await telegramRequest("sendMessage", { chat_id: message.chat.id, text });
  }
}

module.exports = { handleMessage, handleCatalogCommand };
