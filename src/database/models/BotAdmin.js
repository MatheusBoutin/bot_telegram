const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const BotAdmin = sequelize.define(
  "BotAdmin",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    grantedByUserId: { type: DataTypes.INTEGER, allowNull: true },
    grantedAt: { type: DataTypes.DATE, allowNull: false },
    revokedByUserId: { type: DataTypes.INTEGER, allowNull: true },
    revokedAt: { type: DataTypes.DATE, allowNull: true },
  },
  { tableName: "bot_admins" },
);

module.exports = { BotAdmin };
