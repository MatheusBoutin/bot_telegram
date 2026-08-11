const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const Club = sequelize.define(
  "Club",
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },

    telegramChatId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      unique: true,
    },

    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "clubs",
  },
);

module.exports = {
  Club,
};
