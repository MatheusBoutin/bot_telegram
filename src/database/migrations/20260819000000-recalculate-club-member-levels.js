"use strict";

async function recalculateLevels(queryInterface, baseLevelXp, levelXpIncrease) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.sequelize.query(
      `UPDATE club_members
          SET level = LEAST(
            50,
            1 + (
              SELECT COUNT(*)::integer
                FROM generate_series(1, 49) AS progression(current_level)
               WHERE club_members.xp >=
                 (:baseLevelXp * progression.current_level) +
                 (:levelXpIncrease * progression.current_level *
                   (progression.current_level - 1) / 2)
            )
          )`,
      {
        replacements: { baseLevelXp, levelXpIncrease },
        transaction,
      },
    );
  });
}

module.exports = {
  async up(queryInterface) {
    await recalculateLevels(queryInterface, 400, 100);
  },

  async down(queryInterface) {
    await recalculateLevels(queryInterface, 100, 25);
  },
};
