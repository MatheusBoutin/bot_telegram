const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const DartGrant = sequelize.define("DartGrant", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  adminUserId: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.INTEGER, allowNull: false },
  reason: { type: DataTypes.STRING(200), allowNull: true },
  telegramUpdateId: { type: DataTypes.BIGINT, allowNull: false, unique: true },
}, { tableName: "dart_grants" });

module.exports = { DartGrant };
