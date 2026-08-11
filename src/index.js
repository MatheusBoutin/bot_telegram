const { telegramRequest } = require("./telegram");
const { handleMessage } = require("./handlers/messageHandler");
const { sequelize } = require("./database/models");

async function ensureDatabaseIsMigrated() {
  const requiredTables = ["users", "clubs", "club_members"];

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

async function main() {
  await sequelize.authenticate();

  console.log("Banco de dados conectado.");

  await ensureDatabaseIsMigrated();

  console.log("Migrations carregadas.");

  let offset = 0;

  console.log("Bot ligado e aguardando mensagens.");

  while (true) {
    const updates = await telegramRequest("getUpdates", {
      offset: offset,
      timeout: 10,
    });

    if (!Array.isArray(updates)) {
      console.log("O Telegram não retornou uma lista de atualizações.");

      continue;
    }

    for (const update of updates) {
      offset = update.update_id + 1;

      if (update.message) {
        await handleMessage(update.message);
      }
    }
  }
}

main().catch((error) => {
  console.error("Erro:", error.message);

  if (error.code) {
    console.error("Código:", error.code);
  }
});
