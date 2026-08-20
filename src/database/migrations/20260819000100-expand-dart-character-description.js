"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("dart_characters", "description", {
      type: Sequelize.STRING(1200),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("dart_characters", "description", {
      type: Sequelize.STRING(600),
      allowNull: false,
    });
  },
};
