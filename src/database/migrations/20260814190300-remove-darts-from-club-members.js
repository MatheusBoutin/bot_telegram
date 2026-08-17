"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn("club_members", "dartsRefreshedOn", { transaction });
      await queryInterface.removeColumn("club_members", "dartsAvailable", { transaction });
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn("club_members", "dartsAvailable", {
        type: Sequelize.INTEGER, allowNull: false, defaultValue: 3,
      }, { transaction });
      await queryInterface.addColumn("club_members", "dartsRefreshedOn", {
        type: Sequelize.DATEONLY, allowNull: true,
      }, { transaction });
      await queryInterface.sequelize.query(
        `UPDATE club_members cm SET "dartsAvailable" = dp."dartsAvailable",
          "dartsRefreshedOn" = dp."dartsRefreshedOn" FROM dart_players dp
          WHERE dp."userId" = cm."userId"`, { transaction },
      );
    });
  },
};
