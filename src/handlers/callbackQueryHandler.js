const { telegramRequest } = require("../telegram");

const { handleDartCatalogCallback } = require("./dartCatalogCallbackHandler");

const { handleDartGameCallback } = require("./dartGameCallbackHandler");

async function handleCallbackQuery(callbackQuery) {
  const catalogCallbackHandled = await handleDartCatalogCallback(callbackQuery);

  if (catalogCallbackHandled) {
    return;
  }

  const dartGameCallbackHandled = await handleDartGameCallback(callbackQuery);

  if (dartGameCallbackHandled) {
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
