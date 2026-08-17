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
        fields: ["normalizedName"],
        name: "franchises_normalized_name_unique",
      },
      {
        fields: ["active"],
        name: "franchises_active",
      },
    ],
  },
);

module.exports = {
  Franchise,
};
