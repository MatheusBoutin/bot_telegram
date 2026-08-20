const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const DartCollectionEntry = sequelize.define(
  "DartCollectionEntry",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    characterId: { type: DataTypes.INTEGER, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, validate: { min: 1 } },
    firstObtainedAt: { type: DataTypes.DATE, allowNull: false },
    lastObtainedAt: { type: DataTypes.DATE, allowNull: false },
  },
  {
    tableName: "dart_collection_entries",
    indexes: [
      { unique: true, fields: ["userId", "characterId"], name: "dart_collection_entries_user_character_unique" },
      { fields: ["userId"], name: "dart_collection_entries_user" },
    ],
  },
);

module.exports = { DartCollectionEntry };
