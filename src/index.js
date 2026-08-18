require("dotenv").config({ quiet: true });

const { sequelize } = require("./database/models");
const { getBotOwnerId } = require("./config/botOwnerConfig");
const { startHealthServer, closeHealthServer } = require("./http/healthServer");
const { runPolling } = require("./services/pollingService");

let isRunning = true;
let healthServer;
let shutdownPromise;
let shutdownHandlersConfigured = false;

function validateRequiredEnvironment() {
  const missingVariables = [];

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    missingVariables.push("TELEGRAM_BOT_TOKEN");
  }

  getBotOwnerId();

  if (process.env.NODE_ENV === "production") {
    if (!process.env.DATABASE_URL) {
      missingVariables.push("DATABASE_URL");
    }
  } else {
    for (const variable of ["DB_NAME", "DB_USER", "DB_PASSWORD", "DB_HOST"]) {
      if (!process.env[variable]) {
        missingVariables.push(variable);
      }
    }
  }

  if (missingVariables.length > 0) {
    throw new Error(
      `Variáveis de ambiente obrigatórias ausentes: ${missingVariables.join(", ")}.`,
    );
  }
}

async function ensureDatabaseIsMigrated() {
  const requiredTables = [
    "users",
    "clubs",
    "club_members",
    "xp_transactions",
    "franchises",
    "dart_characters",
    "bot_admins",
    "dart_players",
  ];
  const tables = await sequelize.getQueryInterface().showAllTables();
  const tableNames = tables.map((table) =>
    typeof table === "string" ? table : table.tableName,
  );
  const missingTables = requiredTables.filter(
    (tableName) => !tableNames.includes(tableName),
  );

  if (missingTables.length > 0) {
    throw new Error(
      "Banco não migrado. Execute npm run db:migrate antes de iniciar o bot.",
    );
  }
}

function formatError(error) {
  return error?.stack || error?.message || String(error);
}

async function closeResources() {
  try {
    await closeHealthServer(healthServer);
    if (healthServer) {
      console.log("Servidor HTTP encerrado.");
    }
  } catch (error) {
    console.error("Não foi possível encerrar o servidor HTTP:", formatError(error));
  } finally {
    healthServer = undefined;
  }

  try {
    await sequelize.close();
    console.log("Conexão com o banco encerrada.");
  } catch (error) {
    console.error("Não foi possível encerrar o banco:", formatError(error));
  }
}

function requestShutdown(signal) {
  if (!isRunning) {
    return shutdownPromise;
  }

  isRunning = false;
  console.log(`\nSinal ${signal} recebido.`);
  console.log("Encerrando o bot com segurança...");
  return shutdownPromise;
}

function configureShutdownHandlers() {
  if (shutdownHandlersConfigured) {
    return;
  }

  shutdownHandlersConfigured = true;
  process.on("SIGINT", () => requestShutdown("SIGINT"));
  process.on("SIGTERM", () => requestShutdown("SIGTERM"));
}

async function main() {
  validateRequiredEnvironment();
  configureShutdownHandlers();

  await sequelize.authenticate();
  console.log("Banco de dados conectado.");

  await ensureDatabaseIsMigrated();
  console.log("Migrations carregadas.");

  healthServer = await startHealthServer();
  console.log(`Servidor HTTP escutando na porta ${healthServer.address().port}.`);

  await runPolling(() => isRunning);
  await closeResources();
  console.log("Bot desligado.");
}

shutdownPromise = main().catch(async (error) => {
  isRunning = false;
  console.error("Erro fatal ao iniciar o bot:", formatError(error));
  await closeResources();
  process.exitCode = 1;
});
