"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("club_members", "dartsAvailable", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 3,
    });

    await queryInterface.addColumn("club_members", "dartsRefreshedOn", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("club_members", "dartsRefreshedOn");

    await queryInterface.removeColumn("club_members", "dartsAvailable");
  },
};
