"use strict";

const LEGACY_INDEX = "dart_characters_franchise_normalized_name_unique";
const ACTIVE_INDEX = "dart_characters_franchise_active_normalized_name_unique";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex("dart_characters", LEGACY_INDEX, { transaction });
      await queryInterface.addIndex(
        "dart_characters",
        ["franchiseId", "normalizedName"],
        {
          unique: true,
          where: { active: true },
          name: ACTIVE_INDEX,
          transaction,
        },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex("dart_characters", ACTIVE_INDEX, { transaction });
      await queryInterface.addIndex(
        "dart_characters",
        ["franchiseId", "normalizedName"],
        {
          unique: true,
          name: LEGACY_INDEX,
          transaction,
        },
      );
    });
  },
};
