const { telegramRequest } = require("../telegram");
const { getOrCreateUser } = require("../services/userService");
const { getCollectionSummary, getFranchiseCollection } = require("../services/dartCollectionService");
const { buildSummaryView, buildFranchiseView } = require("../commands/collectionCommand");

function isDartCollectionCallback(query) { return query.data?.startsWith("col:") || false; }

async function handleDartCollectionCallback(query) {
  if (!isDartCollectionCallback(query)) return false;
  let answered = false;
  const answer = async (text) => {
    await telegramRequest("answerCallbackQuery", { callback_query_id: query.id, ...(text ? { text } : {}) });
    answered = true;
  };
  try {
    if (!query.message?.chat || !query.from) {
      await answer("Esta ação não está mais disponível.");
      return true;
    }
    const summaryMatch = query.data.match(/^col:s:(\d+):(\d+)$/);
    const franchiseMatch = query.data.match(/^col:f:(\d+):(\d+):(\d+)$/);
    if (!summaryMatch && !franchiseMatch) {
      await answer("Esta ação não está mais disponível.");
      return true;
    }
    const ownerId = Number((summaryMatch || franchiseMatch)[1]);
    const user = await getOrCreateUser({ from: query.from });
    if (user.id !== ownerId) {
      await answer("Esta coleção pertence a outro usuário.");
      return true;
    }
    let view;
    if (summaryMatch) {
      view = buildSummaryView(await getCollectionSummary(user.id), user.id, Number(summaryMatch[2]));
    } else {
      const collection = await getFranchiseCollection(user.id, Number(franchiseMatch[2]));
      if (!collection) {
        await answer("Esta franquia não está mais disponível.");
        return true;
      }
      view = buildFranchiseView(collection, user.id, Number(franchiseMatch[3]));
    }
    await answer();
    await telegramRequest("editMessageText", {
      chat_id: query.message.chat.id, message_id: query.message.message_id,
      text: view.text, parse_mode: "HTML", reply_markup: view.reply_markup,
    });
    return true;
  } catch (error) {
    console.error("Falha ao navegar pela coleção:", error);
    if (!answered) {
      try { await answer("Não foi possível abrir a coleção agora."); } catch (answerError) {
        console.error("Falha ao responder callback da coleção:", answerError);
      }
    }
    return true;
  }
}

module.exports = { handleDartCollectionCallback, isDartCollectionCallback };
