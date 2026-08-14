const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const Franchise = sequelize.define(
  "Franchise",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    clubId: {
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
    tableName: "franchises",

    indexes: [
      {
        unique: true,
        fields: ["clubId", "normalizedName"],
        name: "franchises_club_normalized_name_unique",
      },
      {
        fields: ["clubId", "active"],
        name: "franchises_club_active",
      },
    ],
  },
);

module.exports = {
  Franchise,
};
