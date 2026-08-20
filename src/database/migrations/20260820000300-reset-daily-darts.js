"use strict";

const DARTS_PER_DAY = 3;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE dart_players
          SET "dartsAvailable" = ${DARTS_PER_DAY},
              "dartsRefreshedOn" = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date,
              "updatedAt" = CURRENT_TIMESTAMP`,
    );
  },

  // O reset substitui saldos consumidos e acumulados, portanto não há como
  // reconstruir com segurança os valores anteriores em um rollback.
  async down() {},
};
