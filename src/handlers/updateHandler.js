const { handleMessage } = require("./messageHandler");

const { handleCallbackQuery } = require("./callbackQueryHandler");

async function handleUpdate(update) {
  if (update.message) {
    await handleMessage(update.message);
    return;
  }

  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
  }
}

module.exports = {
  handleUpdate,
};
