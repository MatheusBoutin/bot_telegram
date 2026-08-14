const { sequelize } = require("./database/models");

const { runPolling } = require("./services/pollingService");

let isRunning = true;

async function ensureDatabaseIsMigrated() {
  const requiredTables = [
    "users",
    "clubs",
    "club_members",
    "xp_transactions",
    "franchises",
    "dart_characters",
  ];

  const tables = await sequelize.getQueryInterface().showAllTables();

  const tableNames = tables.map((table) => {
    if (typeof table === "string") {
      return table;
    }

    return table.tableName;
  });

  const missingTables = requiredTables.filter(
    (tableName) => !tableNames.includes(tableName),
  );

  if (missingTables.length > 0) {
    throw new Error(
      "Banco não migrado. Execute npm run db:migrate antes de iniciar o bot.",
    );
  }
}

function configureShutdownHandlers() {
  function requestShutdown(signal) {
    if (!isRunning) {
      console.log("Encerramento forçado.");

      process.exit(1);
    }

    isRunning = false;

    console.log(`\nSinal ${signal} recebido.`);

    console.log("Encerrando o bot com segurança...");
  }

  process.on("SIGINT", () => {
    requestShutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    requestShutdown("SIGTERM");
  });
}

async function closeDatabase() {
  try {
    await sequelize.close();

    console.log("Conexão com o banco encerrada.");
  } catch (error) {
    console.error(
      "Não foi possível encerrar o banco corretamente:",
      error.message,
    );
  }
}

async function main() {
  configureShutdownHandlers();

  await sequelize.authenticate();

  console.log("Banco de dados conectado.");

  await ensureDatabaseIsMigrated();

  console.log("Migrations carregadas.");

  await runPolling(() => isRunning);

  await closeDatabase();

  console.log("Bot desligado.");
}

main().catch(async (error) => {
  console.error("Erro fatal ao iniciar o bot:", error.message);

  if (error.code) {
    console.error("Código:", error.code);
  }

  await closeDatabase();

  process.exitCode = 1;
});
