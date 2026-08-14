"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("franchises", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      clubId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "clubs",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },

      normalizedName: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },

      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      createdByUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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

    await queryInterface.addIndex("franchises", ["clubId", "normalizedName"], {
      unique: true,
      name: "franchises_club_normalized_name_unique",
    });

    await queryInterface.addIndex("franchises", ["clubId", "active"], {
      name: "franchises_club_active",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("franchises");
  },
};
