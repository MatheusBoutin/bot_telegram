"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [conflicts] = await queryInterface.sequelize.query(
        `SELECT "normalizedName", array_agg("name" ORDER BY "id") AS names,
                array_agg("clubId" ORDER BY "id") AS clubs, count(*)::integer AS count
           FROM franchises
          GROUP BY "normalizedName"
         HAVING count(*) > 1
          ORDER BY "normalizedName"`,
        { transaction },
      );

      if (conflicts.length > 0) {
        const details = conflicts.map((row) =>
          `${row.normalizedName}: nomes=[${row.names.join(", ")}], clubIds=[${row.clubs.join(", ")}]`,
        ).join("; ");
        throw new Error(
          "Não é possível globalizar franquias: normalizedName duplicado entre grupos. " +
          `${details}. Diagnóstico: SELECT \"normalizedName\", array_agg(\"name\"), ` +
          `array_agg(\"clubId\"), count(*) FROM franchises GROUP BY \"normalizedName\" HAVING count(*) > 1;`,
        );
      }

      await queryInterface.removeIndex("franchises", "franchises_club_normalized_name_unique", { transaction });
      await queryInterface.removeIndex("franchises", "franchises_club_active", { transaction });
      await queryInterface.addIndex("franchises", ["normalizedName"], {
        unique: true, name: "franchises_normalized_name_unique", transaction,
      });
      await queryInterface.addIndex("franchises", ["active"], {
        name: "franchises_active", transaction,
      });
      await queryInterface.removeColumn("franchises", "clubId", { transaction });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [[firstClub]] = await queryInterface.sequelize.query(
        `SELECT id FROM clubs ORDER BY id LIMIT 1`, { transaction },
      );
      if (!firstClub && (await queryInterface.sequelize.query(
        `SELECT count(*)::integer AS count FROM franchises`, { transaction, type: Sequelize.QueryTypes.SELECT },
      ))[0].count > 0) {
        throw new Error("Down requer ao menos um Club para restaurar franchises.clubId.");
      }
      await queryInterface.addColumn("franchises", "clubId", {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: "clubs", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE",
      }, { transaction });
      if (firstClub) {
        await queryInterface.sequelize.query(`UPDATE franchises SET "clubId" = :clubId`, {
          replacements: { clubId: firstClub.id }, transaction,
        });
      }
      await queryInterface.changeColumn("franchises", "clubId", {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: "clubs", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE",
      }, { transaction });
      await queryInterface.removeIndex("franchises", "franchises_normalized_name_unique", { transaction });
      await queryInterface.removeIndex("franchises", "franchises_active", { transaction });
      await queryInterface.addIndex("franchises", ["clubId", "normalizedName"], {
        unique: true, name: "franchises_club_normalized_name_unique", transaction,
      });
      await queryInterface.addIndex("franchises", ["clubId", "active"], {
        name: "franchises_club_active", transaction,
      });
    });
  },
};
