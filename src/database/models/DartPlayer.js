const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");
const { DARTS_PER_DAY } = require("../../config/dartGameConfig");

const DartPlayer = sequelize.define(
  "DartPlayer",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    dartsAvailable: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: DARTS_PER_DAY,
      validate: { min: 0 },
    },
    dartsRefreshedOn: { type: DataTypes.DATEONLY, allowNull: true },
  },
  { tableName: "dart_players" },
);

module.exports = { DartPlayer };
