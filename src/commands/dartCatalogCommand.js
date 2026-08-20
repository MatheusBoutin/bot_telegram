const { telegramRequest } = require("../telegram");
const { parseFranchiseName } = require("../services/dartCatalogParser");
const { createFranchise, listFranchises, countCharacters, listCharacters, findCharacterById, findFranchiseById } = require("../services/dartCatalogService");
const { saveCatalogSession } = require("../services/dartCatalogSessionService");
const { DART_RARITY_LABELS } = require("../config/dartConfig");

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

async function createFranchiseCommand(message, adminUser) {
  const parsed = parseFranchiseName(message.text);
  if (!parsed.ok) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: `Como usar:\n/criarfranquia Nome da franquia\n\n${parsed.error}` });
  const result = await createFranchise({ adminUser, parsedFranchise: parsed });
  return telegramRequest("sendMessage", { chat_id: message.chat.id, text: result.created ? `✅ Franquia “${result.franchise.name}” criada!\n\nAgora use /adicionarcarta para montar o catálogo.` : `A franquia “${result.franchise.name}” já existe no catálogo global.` });
}

async function listFranchisesCommand(message) {
  const franchises = await listFranchises();
  if (!franchises.length) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Nenhuma franquia foi criada no catálogo global." });
  const counts = await Promise.all(franchises.map(({ id }) => countCharacters(id)));
  const lines = franchises.map((franchise, index) => `ID ${franchise.id} — ${franchise.name} — ${counts[index]} cartas ativas — ${franchise.active ? "ativa" : "arquivada"}`);
  return telegramRequest("sendMessage", { chat_id: message.chat.id, text: `📚 Franquias do catálogo global\n\n${lines.join("\n")}` });
}

async function addCharacterCommand(message) {
  const franchises = await listFranchises({ activeOnly: true });
  if (!franchises.length) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Crie pelo menos uma franquia antes de adicionar cartas." });
  return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Escolha a franquia que receberá a carta:", reply_markup: createFranchiseKeyboard(franchises, "add") });
}

async function listCharactersCommand(message) {
  const franchises = await listFranchises();
  const rows = (await Promise.all(franchises.map(async (franchise) => (await listCharacters(franchise)).map((card) => ({ card, franchise }))))).flat();
  const text = rows.length ? rows.map(({ card, franchise }) => `ID ${card.id} — ${card.name} — ${franchise.name} — ${DART_RARITY_LABELS[card.rarity]} — ${card.active ? "ativa" : "arquivada"}`).join("\n") : "Nenhuma carta cadastrada.";
  return telegramRequest("sendMessage", { chat_id: message.chat.id, text: `🎴 Cartas do catálogo\n\n${text}` });
}

async function deleteCharacterCommand(message, user) {
  const id = parseNumericId(message.text);
  if (!id) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Como usar: /excluircarta <ID>\n\nConsulte os IDs em /cartas." });
  const card = await findCharacterById(id);
  if (!card) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Carta não encontrada." });
  if (!card.active) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Esta carta já está arquivada." });
  saveCatalogSession(message.chat.id, user.id, { stage: "archive_card", characterId: card.id });
  return telegramRequest("sendMessage", { chat_id: message.chat.id, text: `⚠️ Excluir carta do catálogo?\n\nID: ${card.id}\nCarta: ${card.name}\nFranquia: ${card.franchise.name}\nRaridade: ${DART_RARITY_LABELS[card.rarity]}\n\nA carta será removida dos próximos sorteios. Aquisições existentes serão preservadas.`, reply_markup: confirmationKeyboard("card") });
}

async function deleteFranchiseCommand(message, user) {
  const id = parseNumericId(message.text);
  if (!id) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Como usar: /excluirfranquia <ID>\n\nConsulte os IDs em /franquias." });
  const franchise = await findFranchiseById(id);
  if (!franchise) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Franquia não encontrada." });
  if (!franchise.active) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Esta franquia já está arquivada." });
  const activeCards = await countCharacters(id);
  saveCatalogSession(message.chat.id, user.id, { stage: "archive_franchise", franchiseId: id });
  return telegramRequest("sendMessage", { chat_id: message.chat.id, text: `⚠️ Excluir franquia do catálogo?\n\nID: ${id}\nFranquia: ${franchise.name}\nCartas ativas: ${activeCards}\n\nA franquia e suas cartas serão removidas dos próximos sorteios. As coleções existentes serão preservadas.`, reply_markup: confirmationKeyboard("franchise") });
}

module.exports = { createFranchiseCommand, deleteFranchiseCommand, deleteCharacterCommand, listFranchisesCommand, addCharacterCommand, listCharactersCommand, createFranchiseKeyboard, parseNumericId };
