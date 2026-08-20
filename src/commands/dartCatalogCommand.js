const { telegramRequest } = require("../telegram");
const { parseFranchiseName } = require("../services/dartCatalogParser");
const { createFranchise, deleteFranchise, listFranchises, countCharacters } = require("../services/dartCatalogService");

function createFranchiseKeyboard(franchises, action) {
  const rows = [];
  for (let index = 0; index < franchises.length; index += 2) {
    rows.push(franchises.slice(index, index + 2).map((franchise) => ({
      text: franchise.name, callback_data: `catalog:${action}:${franchise.id}`,
    })));
  }
  return { inline_keyboard: rows };
}

async function createFranchiseCommand(message, adminUser) {
  const parsedFranchise = parseFranchiseName(message.text);
  if (!parsedFranchise.ok) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: `Como usar:\n/criarfranquia Nome da franquia\n\n${parsedFranchise.error}` });
  const result = await createFranchise({ adminUser, parsedFranchise });
  return telegramRequest("sendMessage", {
    chat_id: message.chat.id,
    text: result.created ? `✅ Franquia “${result.franchise.name}” criada!\n\nAgora use /adicionarpersonagem para montar o catálogo.` : `A franquia “${result.franchise.name}” já existe no catálogo global.`,
  });
}

async function deleteFranchiseCommand(message) {
  const parsedFranchise = parseFranchiseName(message.text);
  if (!parsedFranchise.ok) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: `Como usar:\n/excluirfranquia Nome da franquia\n\n${parsedFranchise.error}` });
  const result = await deleteFranchise(parsedFranchise);
  if (!result) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: `A franquia “${parsedFranchise.name}” não foi encontrada no catálogo global.` });
  const characterLabel = result.characterCount === 1 ? "personagem vinculado também foi excluído" : "personagens vinculados também foram excluídos";
  return telegramRequest("sendMessage", {
    chat_id: message.chat.id,
    text: `✅ Franquia “${result.franchise.name}” excluída!\n\n${result.characterCount} ${characterLabel}.`,
  });
}

async function listFranchisesCommand(message) {
  const franchises = await listFranchises();
  if (!franchises.length) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Nenhuma franquia foi criada no catálogo global.\n\nUse /criarfranquia Nome da franquia." });
  const counts = await Promise.all(franchises.map(({ id }) => countCharacters(id)));
  const lines = franchises.map((franchise, index) => `• ${franchise.name} — ${counts[index]} ${counts[index] === 1 ? "personagem" : "personagens"} — ${franchise.active ? "ativa" : "desativada"}`);
  return telegramRequest("sendMessage", { chat_id: message.chat.id, text: `🎯 Franquias do catálogo global\n\n${lines.join("\n")}` });
}

async function addCharacterCommand(message) {
  const franchises = await listFranchises({ activeOnly: true });
  if (!franchises.length) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Crie pelo menos uma franquia antes de adicionar personagens.\n\nUse /criarfranquia Nome da franquia." });
  return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Escolha a franquia que receberá o personagem:", reply_markup: createFranchiseKeyboard(franchises, "add") });
}

async function listCharactersCommand(message) {
  const franchises = await listFranchises({ activeOnly: true });
  if (!franchises.length) return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Nenhuma franquia ativa foi encontrada no catálogo global." });
  return telegramRequest("sendMessage", { chat_id: message.chat.id, text: "Escolha a franquia que deseja consultar:", reply_markup: createFranchiseKeyboard(franchises, "list") });
}

module.exports = { createFranchiseCommand, deleteFranchiseCommand, listFranchisesCommand, addCharacterCommand, listCharactersCommand, createFranchiseKeyboard };
