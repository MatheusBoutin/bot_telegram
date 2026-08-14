"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("dart_characters", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      franchiseId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "franchises",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },

      normalizedName: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },

      description: {
        type: Sequelize.STRING(600),
        allowNull: false,
      },

      rarity: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },

      imageFileId: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      imageUniqueId: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      createdByUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
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
      "dart_characters",
      ["franchiseId", "normalizedName"],
      {
        unique: true,
        name: "dart_characters_franchise_normalized_name_unique",
      },
    );

    await queryInterface.addIndex(
      "dart_characters",
      ["franchiseId", "active", "rarity"],
      {
        name: "dart_characters_franchise_active_rarity",
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("dart_characters");
  },
};
