const { Sequelize } = require("sequelize");

require("dotenv").config({
  quiet: true,
});

const commonOptions = {
  dialect: "postgres",
  logging: false,
};

const sequelize =
  process.env.NODE_ENV === "production" && process.env.DATABASE_URL
    ? new Sequelize(process.env.DATABASE_URL, {
        ...commonOptions,
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        },
      })
    : new Sequelize(
        process.env.DB_NAME,
        process.env.DB_USER,
        process.env.DB_PASSWORD,
        {
          ...commonOptions,
          host: process.env.DB_HOST,
          port: process.env.DB_PORT,
        },
      );

module.exports = {
  sequelize,
};
