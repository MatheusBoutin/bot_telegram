const { telegramRequest } = require("../telegram");

const { handleDartCatalogCallback } = require("./dartCatalogCallbackHandler");

async function handleCallbackQuery(callbackQuery) {
  const handled = await handleDartCatalogCallback(callbackQuery);

  if (handled) {
    return;
  }

  await telegramRequest("answerCallbackQuery", {
    callback_query_id: callbackQuery.id,

    text: "Essa ação não está mais disponível.",
  });
}

module.exports = {
  handleCallbackQuery,
};
