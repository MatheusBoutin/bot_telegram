const { sequelize } = require("../database");

const { User } = require("./User");
const { Club } = require("./Club");
const { ClubMember } = require("./ClubMember");

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

module.exports = {
  sequelize,
  User,
  Club,
  ClubMember,
};
