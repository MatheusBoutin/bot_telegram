const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (relative) => fs.readFileSync(path.join(__dirname, "..", relative), "utf8");

test("/cartas é reconhecido, roteado antes do bloco de grupo e mantém o escopo privado", () => {
  const handler = read("src/handlers/messageHandler.js");
  const catalog = read("src/commands/dartCatalogCommand.js");
  assert.match(handler, /getCommandName\(message\.text\) \|\| getCommandName\(message\.caption\)/);
  assert.match(handler, /catalogCommands = new Set\(\[[^\]]*"\/cartas"/s);
  assert.match(handler, /privateCatalogCommands = new Set\(\[[^\]]*"\/cartas"/s);
  assert.match(handler, /\["\/cartas", "\/personagens"\]\.includes\(commandName\).*listCharactersCommand/s);
  assert.match(catalog, /listActiveCatalogCharacters\(\)/);
  assert.match(read("src/services/dartCatalogService.js"), /where: \{ active: true \}/);
});

test("listagem extensa é dividida em mensagens sem quebrar linhas de cartas", () => {
  const { splitCatalogText } = require("../src/commands/dartCatalogCommand");
  const cards = Array.from({ length: 200 }, (_, index) => `${index + 1} — Carta ${index + 1} — Franquia — Lendária`);
  const chunks = splitCatalogText(`🎴 Cartas do catálogo\n\n${cards.join("\n")}`);

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 4096));
  assert.deepEqual(chunks.flatMap((chunk) => chunk.split("\n").filter((line) => /^\d+ — Carta/.test(line))), cards);
});

test("falhas da consulta e do envio do catálogo são capturadas e registradas", () => {
  const catalog = read("src/commands/dartCatalogCommand.js");
  const polling = read("src/services/pollingService.js");
  assert.match(catalog, /catch \(error\) \{\s*console\.error\("Erro ao consultar cartas do catálogo:"/s);
  assert.match(catalog, /console\.error\("Erro ao enviar resposta do \/cartas:", error\)/);
  assert.match(catalog, /return sendCatalogMessages\(message, CATALOG_ERROR_TEXT\)/);
  assert.match(polling, /await processUpdateWithRetry\(update, shouldContinue\)/);
});

test("os quatro recursos de grupo são validados antes de qualquer efeito", () => {
  const handler = read("src/handlers/messageHandler.js");
  const guard = handler.indexOf("if (groupOnlyCommands.has(commandName)");
  assert.ok(guard >= 0);
  for (const effect of ["getOrCreateUser(message)", "getOrCreateClub(message)", "getOrCreateClubMember(user, club)"]) {
    assert.ok(guard < handler.indexOf(effect), `${effect} deve ocorrer depois da guarda`);
  }
  assert.match(handler, /const groupOnlyCommands = new Set\(\["\/literaryxp", "\/rank", "\/statusxp", "\/admliterary"\]\)/);
  assert.match(handler, /text: GROUP_ONLY_NOTICE/);
  assert.equal(read("src/services/commandService.js").includes("split(\"@\")[0].toLowerCase()"), true);
});

test("ajuda identifica os quatro comandos como exclusivos de grupos", () => {
  const help = read("src/commands/helpCommand.js");
  assert.match(help, /\/literaryxp .*\(somente em grupos\)/);
  assert.match(help, /\/rank .*\(somente em grupos\)/);
  assert.match(help, /\/statusxp .*\(somente em grupos\)/);
  assert.match(help, /\/admliterary .*\(somente em grupos\)/);
});
