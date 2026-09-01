const { telegramRequest } = require("../telegram");
const { parseFranchiseName } = require("../services/dartCatalogParser");
const { createFranchise, listFranchises, countCharacters, listActiveCatalogCharacters } = require("../services/dartCatalogService");
const { saveCatalogSession } = require("../services/dartCatalogSessionService");
const { DART_RARITY_LABELS } = require("../config/dartConfig");

const TELEGRAM_TEXT_LIMIT = 4096;
const CATALOG_ERROR_TEXT = "Não foi possível consultar o catálogo agora. Tente novamente em instantes.";

const CARD_RARITY_LABELS = Object.freeze({
  ...DART_RARITY_LABELS,
  rare: "Rara",
  epic: "Épica",
  legendary: "Lendária",
});

function createFranchiseKeyboard(franchises, action) {
  const rows = [];
  for (let index = 0; index < franchises.length; index += 2) rows.push(franchises.slice(index, index + 2).map((franchise) => ({ text: franchise.name, callback_data: `catalog:${action}:${franchise.id}` })));
  return { inline_keyboard: rows };
}

function parseNumericId(text) {
  const parts = String(text || "").trim().split(/\s+/);
  return parts.length === 2 && /^\d+$/.test(parts[1]) && Number(parts[1]) > 0 ? Number(parts[1]) : null;
}

function confirmationKeyboard(type) {
  return { inline_keyboard: [[{ text: "✅ Confirmar exclusão", callback_data: `catalog:archive:${type}:confirm` }, { text: "❌ Cancelar", callback_data: `catalog:archive:${type}:cancel` }]] };
}

function resolvePublicItem(items, publicNumber) {
  return items[publicNumber - 1] || null;
}

function formatCharacterList(cards) {
  return cards.map((card, index) => `${index + 1} — ${card.name} — ${card.franchise.name} — ${CARD_RARITY_LABELS[card.rarity]}`).join("\n");
}

function formatFranchiseList(franchises, counts) {
  return franchises.map((franchise, index) => `${index + 1} — ${franchise.name} — ${counts[index]} ${counts[index] === 1 ? "carta" : "cartas"}`).join("\n");
}

function splitCatalogText(text, limit = TELEGRAM_TEXT_LIMIT) {
  const lines = String(text).split("\n");
  const chunks = [];
  let current = "";

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (current && candidate.length > limit) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }

  if (current || !chunks.length) chunks.push(current);
  return chunks;
}

async function sendCatalogMessages(message, text) {
  for (const chunk of splitCatalogText(text)) {
    try {
      await telegramRequest("sendMessage", { chat_id: message.chat.id, text: chunk });
    } catch (error) {
      console.error("Erro ao enviar resposta do /cartas:", error);
      return false;
    }
  }
  return true;
}

async function createFranchiseCommand(message, adminUser) {
  const parsed = parseFranchiseName(message.text);
  if (!parsed.ok) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: `Como usar:\n/criarfranquia Nome da franquia\n\n${parsed.error}` });
  const result = await createFranchise({ adminUser, parsedFranchise: parsed });
  return telegramRequest("sendMessage", { chat_id: message.chat.id, text: result.created ? `✅ Franquia “${result.franchise.name}” criada!\n\nAgora use /adicionarcarta para montar o catálogo.` : `A franquia “${result.franchise.name}” já existe no catálogo global.` });
}

async function listFranchisesCommand(message) {
  const franchises = await listFranchises({ activeOnly: true });
  if (!franchises.length) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Nenhuma franquia cadastrada." });
  const counts = await Promise.all(franchises.map(({ id }) => countCharacters(id)));
  return telegramRequest("sendMessage", { chat_id: message.chat.id, text: `📚 Franquias do catálogo global\n\n${formatFranchiseList(franchises, counts)}` });
}

async function addCharacterCommand(message) {
  const franchises = await listFranchises({ activeOnly: true });
  if (!franchises.length) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Crie pelo menos uma franquia antes de adicionar cartas." });
  return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Escolha a franquia que receberá a carta:", reply_markup: createFranchiseKeyboard(franchises, "add") });
}

async function listCharactersCommand(message) {
  let cards;
  try {
    cards = await listActiveCatalogCharacters();
  } catch (error) {
    console.error("Erro ao consultar cartas do catálogo:", error);
    return sendCatalogMessages(message, CATALOG_ERROR_TEXT);
  }

  const text = cards.length ? formatCharacterList(cards) : "Nenhuma carta cadastrada.";
  return sendCatalogMessages(message, `🎴 Cartas do catálogo\n\n${text}`);
}

async function deleteCharacterCommand(message, user) {
  const publicNumber = parseNumericId(message.text);
  if (!publicNumber) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Como usar: /excluircarta <número>\n\nConsulte a numeração em /cartas." });
  const cards = await listActiveCatalogCharacters();
  const card = resolvePublicItem(cards, publicNumber);
  if (!card) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Carta não encontrada. Use /cartas para consultar a numeração atual." });
  saveCatalogSession(message.chat.id, user.id, { stage: "archive_card", characterId: card.id });
  return telegramRequest("sendMessage", { chat_id: message.chat.id, text: `⚠️ Remover carta do catálogo?\n\nCarta: ${card.name}\nFranquia: ${card.franchise.name}\n\nA carta será removida dos próximos sorteios. Aquisições existentes serão preservadas.`, reply_markup: confirmationKeyboard("card") });
}

async function deleteFranchiseCommand(message, user) {
  const publicNumber = parseNumericId(message.text);
  if (!publicNumber) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Como usar: /excluirfranquia <número>\n\nConsulte a numeração em /franquias." });
  const franchises = await listFranchises({ activeOnly: true });
  const franchise = resolvePublicItem(franchises, publicNumber);
  if (!franchise) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Franquia não encontrada. Use /franquias para consultar a numeração atual." });
  const cardCount = await countCharacters(franchise.id);
  saveCatalogSession(message.chat.id, user.id, { stage: "archive_franchise", franchiseId: franchise.id });
  return telegramRequest("sendMessage", { chat_id: message.chat.id, text: `⚠️ Remover franquia do catálogo?\n\nFranquia: ${franchise.name}\nCartas: ${cardCount}\n\nA franquia e suas cartas serão removidas dos próximos sorteios. As coleções existentes serão preservadas.`, reply_markup: confirmationKeyboard("franchise") });
}

module.exports = { createFranchiseCommand, deleteFranchiseCommand, deleteCharacterCommand, listFranchisesCommand, addCharacterCommand, listCharactersCommand, createFranchiseKeyboard, parseNumericId, resolvePublicItem, formatCharacterList, formatFranchiseList, splitCatalogText };
