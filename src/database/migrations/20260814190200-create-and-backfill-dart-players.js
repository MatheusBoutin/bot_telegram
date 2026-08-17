"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable("dart_players", {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        userId: {
          type: Sequelize.INTEGER, allowNull: false, unique: true,
          references: { model: "users", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE",
        },
        dartsAvailable: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 3 },
        dartsRefreshedOn: { type: Sequelize.DATEONLY, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      }, { transaction });

      // Saldo efetivo: membros atualizados hoje mantêm saldo limitado a 0..3;
      // membros antigos equivalem ao refresh de 3. MIN preserva o maior consumo.
      await queryInterface.sequelize.query(
        `INSERT INTO dart_players ("userId", "dartsAvailable", "dartsRefreshedOn", "createdAt", "updatedAt")
         SELECT "userId",
                MIN(CASE WHEN "dartsRefreshedOn" = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
                         THEN LEAST(3, GREATEST(0, "dartsAvailable")) ELSE 3 END),
                (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
           FROM club_members
          GROUP BY "userId"`,
        { transaction },
      );
    });
  },
  async down(queryInterface) { await queryInterface.dropTable("dart_players"); },
};
