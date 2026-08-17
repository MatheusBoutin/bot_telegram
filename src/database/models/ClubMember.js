const { DataTypes } = require("sequelize");

const { sequelize } = require("../database");

const ClubMember = sequelize.define(
  "ClubMember",
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },

    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    clubId: {
      type: DataTypes.INTEGER,
      allowNull: false,
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
    tableName: "club_members",

    indexes: [
      {
        unique: true,
        fields: ["userId", "clubId"],
        name: "club_members_user_club_unique",
      },
    ],
  },
);

module.exports = {
  ClubMember,
};
