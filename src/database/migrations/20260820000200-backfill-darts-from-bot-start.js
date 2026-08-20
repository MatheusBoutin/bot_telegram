"use strict";

const DARTS_START_DAY = "2026-08-16";
const DARTS_PER_DAY = 3;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE dart_players
          SET "dartsAvailable" = "dartsAvailable" +
              GREATEST(
                ("createdAt" AT TIME ZONE 'America/Sao_Paulo')::date - DATE '${DARTS_START_DAY}',
                0
              ) * ${DARTS_PER_DAY},
              "updatedAt" = CURRENT_TIMESTAMP`,
    );
  },

  // O saldo pode ter sido consumido depois do crédito, então o rollback não
  // subtrai explorações e evita produzir um saldo incorreto.
  async down() {},
};
