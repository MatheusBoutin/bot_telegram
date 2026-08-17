"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("bot_admins", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      userId: {
        type: Sequelize.INTEGER, allowNull: false, unique: true,
        references: { model: "users", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE",
      },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      grantedByUserId: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: "users", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL",
      },
      grantedAt: { type: Sequelize.DATE, allowNull: false },
      revokedByUserId: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: "users", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL",
      },
      revokedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex("bot_admins", ["active"], { name: "bot_admins_active" });
  },
  async down(queryInterface) { await queryInterface.dropTable("bot_admins"); },
};
