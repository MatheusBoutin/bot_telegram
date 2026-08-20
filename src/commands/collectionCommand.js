const { telegramRequest } = require("../telegram");
const { DART_RARITY_LABELS, DART_RARITY_EMOJIS } = require("../config/dartConfig");
const { getCollectionSummary, getFranchiseCollection } = require("../services/dartCollectionService");

// Cinco nomes no pior caso (120 caracteres totalmente escapados em HTML)
// ainda deixam a mensagem abaixo do limite de 4096 caracteres do Telegram.
const SUMMARY_PAGE_SIZE = 5;
const DETAIL_PAGE_SIZE = 5;

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function clampPage(page, totalPages) {
  return Math.min(Math.max(Number.isInteger(page) ? page : 0, 0), Math.max(totalPages - 1, 0));
}

function navigationRow({ userId, page, totalPages, franchiseId }) {
  if (totalPages <= 1) return [];
  const prefix = franchiseId ? `col:f:${userId}:${franchiseId}` : `col:s:${userId}`;
  return [[
    { text: "◀️", callback_data: `${prefix}:${Math.max(0, page - 1)}` },
    { text: "▶️", callback_data: `${prefix}:${Math.min(totalPages - 1, page + 1)}` },
  ]];
}

function buildSummaryView(summary, userId, requestedPage = 0) {
  if (summary.franchises.length === 0) {
    return { text: "O catálogo ainda não possui cartas disponíveis.", reply_markup: { inline_keyboard: [] } };
  }
  const totalPages = Math.max(1, Math.ceil(summary.franchises.length / SUMMARY_PAGE_SIZE));
  const page = clampPage(requestedPage, totalPages);
  const visible = summary.franchises.slice(page * SUMMARY_PAGE_SIZE, (page + 1) * SUMMARY_PAGE_SIZE);
  const lines = visible.map((item) => `${escapeHtml(item.name)} — ${item.obtained}/${item.total}${item.obtained === item.total ? " ✅" : ""}`);
  let text = `🎴 <b>Sua coleção</b>\n\n${lines.join("\n")}\n\n<b>Total: ${summary.obtained}/${summary.total} cartas encontradas</b>`;
  if (totalPages > 1) text += `\n\nPágina ${page + 1}/${totalPages}`;
  text += summary.obtained === 0
    ? "\n\nUse /acervo para encontrar sua primeira carta."
    : "\n\nEscolha uma franquia para ver suas cartas:";
  const franchiseButtons = visible.map((item) => [{
    text: item.name.length > 60 ? `${item.name.slice(0, 59)}…` : item.name,
    callback_data: `col:f:${userId}:${item.id}:0`,
  }]);
  return {
    text,
    reply_markup: { inline_keyboard: [...franchiseButtons, ...navigationRow({ userId, page, totalPages })] },
  };
}

function formatCard(card, archived = false) {
  const rarity = `${DART_RARITY_EMOJIS[card.rarity] || ""} ${DART_RARITY_LABELS[card.rarity] || card.rarity}`.trim();
  const quantity = card.quantity > 1 ? ` ×${card.quantity}` : "";
  return `${archived ? "🗃️" : "✅"} ${escapeHtml(card.name)}${quantity}${rarity ? ` — ${escapeHtml(rarity)}` : ""}`;
}

function buildFranchiseView(collection, userId, requestedPage = 0) {
  const rows = [
    ...collection.obtained.map((card) => ({ card, archived: false })),
    ...collection.archived.map((card) => ({ card, archived: true })),
  ];
  const totalPages = Math.max(1, Math.ceil(rows.length / DETAIL_PAGE_SIZE));
  const page = clampPage(requestedPage, totalPages);
  const visible = rows.slice(page * DETAIL_PAGE_SIZE, (page + 1) * DETAIL_PAGE_SIZE);
  const cardLines = visible.map(({ card, archived }) => formatCard(card, archived));
  let text = `🎴 <b>${escapeHtml(collection.franchise.name)}</b>\n\n<b>Coleção: ${collection.obtainedCount}/${collection.total} cartas encontradas</b>`;
  if (cardLines.length) text += `\n\n${cardLines.join("\n")}`;
  const missing = Math.max(0, collection.total - collection.obtainedCount);
  text += missing > 0 ? `\n\n🔒 ${missing === 1 ? "Falta 1 carta" : `Faltam ${missing} cartas`}` : "\n\n✅ Franquia completa!";
  if (collection.archived.length) text += "\n\n🗃️ Cartas arquivadas não contam para a conclusão atual.";
  text += `\n\nPágina ${page + 1}/${totalPages}`;
  return {
    text,
    reply_markup: { inline_keyboard: [
      ...navigationRow({ userId, page, totalPages, franchiseId: collection.franchise.id }),
      [{ text: "⬅️ Voltar", callback_data: `col:s:${userId}:0` }],
    ] },
  };
}

async function collectionCommand(message, user) {
  const view = buildSummaryView(await getCollectionSummary(user.id), user.id, 0);
  await telegramRequest("sendMessage", {
    chat_id: message.chat.id, text: view.text, parse_mode: "HTML", reply_markup: view.reply_markup,
  });
}

module.exports = {
  collectionCommand, buildSummaryView, buildFranchiseView, escapeHtml, SUMMARY_PAGE_SIZE, DETAIL_PAGE_SIZE,
};
