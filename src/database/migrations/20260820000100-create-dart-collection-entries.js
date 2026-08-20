"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("dart_collection_entries", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      characterId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "dart_characters", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      firstObtainedAt: { type: Sequelize.DATE, allowNull: false },
      lastObtainedAt: { type: Sequelize.DATE, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addConstraint("dart_collection_entries", {
      fields: ["quantity"],
      type: "check",
      where: { quantity: { [Sequelize.Op.gte]: 1 } },
      name: "dart_collection_entries_quantity_positive",
    });
    await queryInterface.addIndex("dart_collection_entries", ["userId", "characterId"], {
      unique: true,
      name: "dart_collection_entries_user_character_unique",
    });
    await queryInterface.addIndex("dart_collection_entries", ["userId"], {
      name: "dart_collection_entries_user",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("dart_collection_entries");
  },
};
