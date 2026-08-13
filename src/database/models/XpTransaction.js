const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const XpTransaction = sequelize.define(
  "XpTransaction",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    clubMemberId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    clubId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    adminUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notZero(value) {
          if (value === 0) {
            throw new Error("Uma transação de XP não pode ter valor zero.");
          }
        },
      },
    },

    source: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },

    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    telegramMessageId: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    originalTransactionId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "xp_transactions",
    indexes: [
      {
        unique: true,
        fields: ["clubId", "telegramMessageId"],
        name: "xp_transactions_club_message_unique",
      },
      {
        unique: true,
        fields: ["originalTransactionId"],
        name: "xp_transactions_original_unique",
      },
      {
        fields: ["clubMemberId", "createdAt"],
        name: "xp_transactions_member_created_at",
      },
    ],
  },
);

module.exports = {
  XpTransaction,
};
