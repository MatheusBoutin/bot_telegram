const { telegramRequest } = require("../telegram");

const { handleDartCatalogCallback } = require("./dartCatalogCallbackHandler");

const { handleDartGameCallback } = require("./dartGameCallbackHandler");
const { handleDartCollectionCallback } = require("./dartCollectionCallbackHandler");

async function handleCallbackQuery(callbackQuery, context = {}) {
  const collectionCallbackHandled = await handleDartCollectionCallback(callbackQuery);
  if (collectionCallbackHandled) return;

  const catalogCallbackHandled = await handleDartCatalogCallback(callbackQuery);

  if (catalogCallbackHandled) {
    return;
  }

  const dartGameCallbackHandled = await handleDartGameCallback(callbackQuery, context);

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
