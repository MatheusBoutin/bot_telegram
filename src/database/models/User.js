const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },

    telegramId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    username: {
      type: DataTypes.STRING,
      allowNull: true,
    },

  },
  {
    tableName: "users",
  },
);

module.exports = {
  User,
};
