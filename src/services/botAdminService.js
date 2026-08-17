const { BotAdmin, User } = require("../database/models");
const { getBotOwnerId } = require("../config/botOwnerConfig");

function isOwnerTelegramId(telegramId) {
  return String(telegramId) === getBotOwnerId();
}

function isOwner(user) {
  return Boolean(user && isOwnerTelegramId(user.telegramId));
}

async function isActiveBotAdmin(user) {
  if (!user) return false;
  return Boolean(await BotAdmin.findOne({ where: { userId: user.id, active: true } }));
}

async function canManageBot(user) {
  return isOwner(user) || isActiveBotAdmin(user);
}

async function grantBotAdmin(targetUser, grantedByUser) {
  if (isOwner(targetUser)) return { changed: false, owner: true };

  const [record, created] = await BotAdmin.findOrCreate({
    where: { userId: targetUser.id },
    defaults: {
      active: true,
      grantedByUserId: grantedByUser.id,
      grantedAt: new Date(),
    },
  });

  if (!created && !record.active) {
    await record.update({
      active: true,
      grantedByUserId: grantedByUser.id,
      grantedAt: new Date(),
      revokedByUserId: null,
      revokedAt: null,
    });
    return { changed: true, record };
  }

  return { changed: created, record };
}

async function revokeBotAdmin(targetUser, revokedByUser) {
  if (isOwner(targetUser)) return { changed: false, owner: true };
  const record = await BotAdmin.findOne({ where: { userId: targetUser.id } });
  if (!record || !record.active) return { changed: false, record };
  await record.update({
    active: false,
    revokedByUserId: revokedByUser.id,
    revokedAt: new Date(),
  });
  return { changed: true, record };
}

async function listActiveBotAdmins() {
  return BotAdmin.findAll({
    where: { active: true },
    include: [{ model: User, as: "user", required: true }],
    order: [[{ model: User, as: "user" }, "name", "ASC"]],
  });
}

module.exports = {
  isOwnerTelegramId,
  isOwner,
  isActiveBotAdmin,
  canManageBot,
  grantBotAdmin,
  revokeBotAdmin,
  listActiveBotAdmins,
};
