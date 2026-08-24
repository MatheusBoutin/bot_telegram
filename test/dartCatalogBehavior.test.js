const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (relative) => fs.readFileSync(path.join(__dirname, "..", relative), "utf8");

test("/cartas separa catálogo ativo do arquivo", () => {
  const command = read("src/commands/dartCatalogCommand.js");
  assert.match(command, /listCharacters\(franchise, \{ active: !archivedOnly \}\)/);
  assert.match(command, /Nenhuma carta ativa cadastrada\./);
  assert.match(command, /archivedOnly/);
});

test("cartas arquivadas continuam protegidas por acesso global e chat privado", () => {
  const handler = read("src/handlers/messageHandler.js");
  assert.match(handler, /privateCatalogCommands[^;]+"\/cartas"/);
  assert.match(handler, /privateCatalogCommands\.has\(commandName\).*chat\.type !== "private"/s);
  assert.match(handler, /if \(!\(await canManageBot\(user\)\)\)/);
});

test("callback de exclusão edita a confirmação, remove botões e é idempotente", () => {
  const callback = read("src/handlers/dartCatalogCallbackHandler.js");
  assert.match(callback, /editMessageText/);
  assert.match(callback, /reply_markup: \{ inline_keyboard: \[\] \}/);
  assert.match(callback, /takeCatalogSession/);
  assert.match(callback, /Esta exclusão já foi processada\./);
  assert.match(callback, /❌ Exclusão cancelada\./);
  assert.match(callback, /Ela não aparecerá em novos sorteios nem na listagem de cartas ativas\./);
});

test("nenhuma migration renumera IDs de cartas", () => {
  const migrationsPath = path.join(__dirname, "../src/database/migrations");
  const sources = fs.readdirSync(migrationsPath).map((file) => fs.readFileSync(path.join(migrationsPath, file), "utf8")).join("\n");
  assert.doesNotMatch(sources, /UPDATE\s+dart_characters\s+SET\s+id|ALTER\s+SEQUENCE[^;]+RESTART/is);
});
