require("dotenv").config({
  quiet: true,
});

function getDatabaseConfig() {
  return {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,

    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,

    dialect: "postgres",
    logging: false,
  };
}

module.exports = {
  development: getDatabaseConfig(),
  test: getDatabaseConfig(),
  production: getDatabaseConfig(),
};
