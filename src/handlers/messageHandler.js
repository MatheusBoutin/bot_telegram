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

const {
  createFranchiseCommand,
  listFranchisesCommand,
  addCharacterCommand,
  listCharactersCommand,
} = require("../commands/dartCatalogCommand");

const { getTitle } = require("../services/titleService");

const { getOrCreateUser } = require("../services/userService");

const { getOrCreateClub } = require("../services/clubService");

const { getOrCreateClubMember } = require("../services/clubMemberService");

const { getCommandName } = require("../services/commandService");

const { ensureGroupAdmin } = require("../services/adminService");

const { handleCatalogUpload } = require("../services/dartCatalogUploadService");

const { isValidXpMessage, canGainXp, addXp } = require("../services/xpService");

const adminCommands = new Set([
  "/darxp",
  "/ajustarxp",
  "/historico",
  "/desfazerxp",
  "/comandosadm",
  "/statusxp",
  "/criarfranquia",
  "/franquias",
  "/adicionarpersonagem",
  "/personagens",
]);

async function handleMessage(message) {
  if (!message.from) {
    return;
  }

  if (message.from.is_bot) {
    return;
  }

  const user = await getOrCreateUser(message);

  const club = await getOrCreateClub(message);

  const member = await getOrCreateClubMember(user, club);

  // =========================
  // UPLOAD DO CATÁLOGO
  // =========================

  const catalogUploadHandled = await handleCatalogUpload(message, user, club);

  if (catalogUploadHandled) {
    return;
  }

  const commandName = getCommandName(message.text);

  // =========================
  // COMANDOS ADMINISTRATIVOS
  // =========================

  if (adminCommands.has(commandName)) {
    const userIsAdmin = await ensureGroupAdmin(message);

    if (!userIsAdmin) {
      return;
    }

    // =========================
    // ADMINISTRAÇÃO DE XP
    // =========================

    if (commandName === "/darxp") {
      await grantXpCommand(message, user, club);
      return;
    }

    if (commandName === "/ajustarxp") {
      await adjustXpCommand(message, user, club);
      return;
    }

    if (commandName === "/historico") {
      await xpHistoryCommand(message, club);
      return;
    }

    if (commandName === "/desfazerxp") {
      await undoXpCommand(message, user, club);
      return;
    }

    if (commandName === "/comandosadm") {
      await adminHelpCommand(message);
      return;
    }

    if (commandName === "/statusxp") {
      await xpStatusCommand(message, club);
      return;
    }

    // =========================
    // CATÁLOGO DE DARDOS
    // =========================

    if (commandName === "/criarfranquia") {
      await createFranchiseCommand(message, user, club);

      return;
    }

    if (commandName === "/franquias") {
      await listFranchisesCommand(message, club);
      return;
    }

    if (commandName === "/adicionarpersonagem") {
      await addCharacterCommand(message, club);
      return;
    }

    if (commandName === "/personagens") {
      await listCharactersCommand(message, club);
      return;
    }
  }

  // =========================
  // COMANDO /perfil
  // =========================

  if (commandName === "/perfil") {
    await profileCommand(message, user, member, club);

    return;
  }

  // =========================
  // COMANDO /rank
  // =========================

  if (commandName === "/rank") {
    await rankCommand(message, club);
    return;
  }

  // =========================
  // COMANDO /dardos
  // =========================

  if (commandName === "/dardos") {
    await dartsCommand(message, user, club, member);

    return;
  }

  // Impede comandos desconhecidos
  // de entregarem XP automático.
  if (commandName) {
    return;
  }

  // =========================
  // XP AUTOMÁTICO
  // =========================

  if (!isValidXpMessage(message, member)) {
    return;
  }

  if (!canGainXp(member)) {
    return;
  }

  const result = await addXp(member, message);

  console.log(
    `${user.name} ganhou ${result.xpGained} XP em ` +
      `${club.name}. Total: ${member.xp}`,
  );

  if (result.leveledUp) {
    const oldTitle = getTitle(result.previousLevel);

    const newTitle = getTitle(member.level);

    let levelUpMessage =
      `🎉 ${user.name} subiu de nível!\n\n` + `⭐ Novo nível: ${member.level}`;

    if (oldTitle !== newTitle) {
      levelUpMessage += `\n\n🏷️ Novo título desbloqueado:\n` + `${newTitle}`;
    }

    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,
      text: levelUpMessage,
    });
  }
}

module.exports = {
  handleMessage,
};
