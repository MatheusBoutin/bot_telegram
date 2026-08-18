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

function getProductionDatabaseConfig() {
  if (!process.env.DATABASE_URL) {
    return getDatabaseConfig();
  }

  return {
    use_env_variable: "DATABASE_URL",
    dialect: "postgres",
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    logging: false,
  };
}

module.exports = {
  development: getDatabaseConfig(),
  test: getDatabaseConfig(),
  production: getProductionDatabaseConfig(),
};
