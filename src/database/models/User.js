const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const User = sequelize.define(
  "User",
  {
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

    xp: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },

    messageCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    lastXpAt: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },

    lastMessage: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "",
    },

    lastMessageAt: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "users",
  },
);

module.exports = {
  User,
};
