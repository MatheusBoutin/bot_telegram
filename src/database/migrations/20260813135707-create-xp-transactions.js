"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("xp_transactions", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      clubMemberId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "club_members",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      clubId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "clubs",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      adminUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      source: {
        type: Sequelize.STRING(40),
        allowNull: false,
      },

      reason: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      telegramMessageId: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },

      originalTransactionId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "xp_transactions",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex(
      "xp_transactions",
      ["clubId", "telegramMessageId"],
      {
        unique: true,
        name: "xp_transactions_club_message_unique",
      },
    );

    await queryInterface.addIndex(
      "xp_transactions",
      ["originalTransactionId"],
      {
        unique: true,
        name: "xp_transactions_original_unique",
      },
    );

    await queryInterface.addIndex(
      "xp_transactions",
      ["clubMemberId", "createdAt"],
      {
        name: "xp_transactions_member_created_at",
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("xp_transactions");
  },
};
