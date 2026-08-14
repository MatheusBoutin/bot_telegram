"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("club_members", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,

        references: {
          model: "users",
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

      xp: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      level: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },

      messageCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      lastXpAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
        defaultValue: 0,
      },

      lastMessage: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: "",
      },

      lastMessageAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
        defaultValue: 0,
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      dartsAvailable: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 3,
      },

      dartsRefreshedOn: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
    });

    await queryInterface.addIndex("club_members", ["userId", "clubId"], {
      unique: true,
      name: "club_members_user_club_unique",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("club_members");
  },
};
