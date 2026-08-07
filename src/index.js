const { telegramRequest } = require("./telegram.js");
const { handleMessage } = require("./handlers/messageHandler.js");
const { sequelize } = require("./database/database.js");

async function main() {
  await sequelize.authenticate();

  console.log("Banco de dados conectado.");

  await sequelize.sync();

  console.log("Tabelas carregadas.");

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
