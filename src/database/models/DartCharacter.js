const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const DartCharacter = sequelize.define(
  "DartCharacter",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    franchiseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },

    normalizedName: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },

    description: {
      type: DataTypes.STRING(1200),
      allowNull: false,
    },

    rarity: {
      type: DataTypes.STRING(20),
      allowNull: false,

      validate: {
        isIn: [["common", "uncommon", "rare", "epic", "legendary"]],
      },
    },

    imageFileId: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    imageUniqueId: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    createdByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "dart_characters",

    indexes: [
      {
        unique: true,
        fields: ["franchiseId", "normalizedName"],
        where: { active: true },
        name: "dart_characters_franchise_active_normalized_name_unique",
      },
      {
        fields: ["franchiseId", "active", "rarity"],
        name: "dart_characters_franchise_active_rarity",
      },
    ],
  },
);

module.exports = {
  DartCharacter,
};
