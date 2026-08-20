const { sequelize } = require("../database");
const { User } = require("./User");
const { Club } = require("./Club");
const { ClubMember } = require("./ClubMember");
const { XpTransaction } = require("./XpTransaction");
const { Franchise } = require("./Franchise");
const { DartCharacter } = require("./DartCharacter");
const { BotAdmin } = require("./BotAdmin");
const { DartPlayer } = require("./DartPlayer");
const { DartCollectionEntry } = require("./DartCollectionEntry");

User.hasMany(ClubMember, {
  foreignKey: "userId",
  as: "memberships",
});

ClubMember.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

Club.hasMany(ClubMember, {
  foreignKey: "clubId",
  as: "members",
});

ClubMember.belongsTo(Club, {
  foreignKey: "clubId",
  as: "club",
});

ClubMember.hasMany(XpTransaction, {
  foreignKey: "clubMemberId",
  as: "xpTransactions",
});

XpTransaction.belongsTo(ClubMember, {
  foreignKey: "clubMemberId",
  as: "member",
});

Club.hasMany(XpTransaction, {
  foreignKey: "clubId",
  as: "xpTransactions",
});

XpTransaction.belongsTo(Club, {
  foreignKey: "clubId",
  as: "club",
});

User.hasMany(XpTransaction, {
  foreignKey: "adminUserId",
  as: "performedXpTransactions",
});

XpTransaction.belongsTo(User, {
  foreignKey: "adminUserId",
  as: "admin",
});

XpTransaction.belongsTo(XpTransaction, {
  foreignKey: "originalTransactionId",
  as: "originalTransaction",
});

XpTransaction.hasOne(XpTransaction, {
  foreignKey: "originalTransactionId",
  as: "reversal",
});

User.hasOne(DartPlayer, { foreignKey: "userId", as: "dartPlayer" });
DartPlayer.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasMany(DartCollectionEntry, { foreignKey: "userId", as: "dartCollectionEntries" });
DartCollectionEntry.belongsTo(User, { foreignKey: "userId", as: "user" });
DartCharacter.hasMany(DartCollectionEntry, { foreignKey: "characterId", as: "collectionEntries" });
DartCollectionEntry.belongsTo(DartCharacter, { foreignKey: "characterId", as: "character" });

User.hasOne(BotAdmin, { foreignKey: "userId", as: "botAdmin" });
BotAdmin.belongsTo(User, { foreignKey: "userId", as: "user" });
BotAdmin.belongsTo(User, { foreignKey: "grantedByUserId", as: "grantedBy" });
BotAdmin.belongsTo(User, { foreignKey: "revokedByUserId", as: "revokedBy" });

User.hasMany(Franchise, {
  foreignKey: "createdByUserId",
  as: "createdFranchises",
});

Franchise.belongsTo(User, {
  foreignKey: "createdByUserId",
  as: "creator",
});

Franchise.hasMany(DartCharacter, {
  foreignKey: "franchiseId",
  as: "characters",
});

DartCharacter.belongsTo(Franchise, {
  foreignKey: "franchiseId",
  as: "franchise",
});

User.hasMany(DartCharacter, {
  foreignKey: "createdByUserId",
  as: "createdDartCharacters",
});

DartCharacter.belongsTo(User, {
  foreignKey: "createdByUserId",
  as: "creator",
});

module.exports = {
  sequelize,
  User,
  Club,
  ClubMember,
  XpTransaction,
  Franchise,
  DartCharacter,
  BotAdmin,
  DartPlayer,
  DartCollectionEntry,
};
