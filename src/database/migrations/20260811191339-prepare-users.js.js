"use strict";

function getTableName(table) {
  if (typeof table === "string") {
    return table;
  }

  return table.tableName;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();

    const usersTableExists = tables.some(
      (table) => getTableName(table) === "users",
    );

    if (usersTableExists) {
      return;
    }

    await queryInterface.createTable("users", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      telegramId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        unique: true,
      },

      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      username: {
        type: Sequelize.STRING,
        allowNull: true,
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
  },

  async down() {
    // Não apagamos users porque ela pode existir
    // desde antes das migrations.
  },
};
