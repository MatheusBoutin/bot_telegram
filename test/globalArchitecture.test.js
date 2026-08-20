const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { refreshPlayerForDay } = require("../src/services/dartGameService");

const read = (relative) => fs.readFileSync(path.join(__dirname, "..", relative), "utf8");

test("refresh diário global preserva consumo no mesmo dia e renova no dia seguinte", () => {
  const player = { dartsAvailable: 2, dartsRefreshedOn: "2026-08-14" };
  assert.equal(refreshPlayerForDay(player, "2026-08-14"), false);
  assert.equal(player.dartsAvailable, 2);
  assert.equal(refreshPlayerForDay(player, "2026-08-15"), true);
  assert.equal(player.dartsAvailable, 3);
});

test("refresh diario redefine a cota sem acumular dias transcorridos", () => {
  const player = { dartsAvailable: 2, dartsRefreshedOn: "2026-08-14" };
  assert.equal(refreshPlayerForDay(player, "2026-08-17"), true);
  assert.equal(player.dartsAvailable, 3);
  assert.equal(player.dartsRefreshedOn, "2026-08-17");
});

test("saldo legado 18 e normalizado no mesmo dia", () => {
  const player = { dartsAvailable: 18, dartsRefreshedOn: "2026-08-17" };
  assert.equal(refreshPlayerForDay(player, "2026-08-17"), true);
  assert.equal(player.dartsAvailable, 3);
});

test("handler trata dardos antes de criar Club e bloqueia recursos específicos de grupo no privado", () => {
  const source = read("src/handlers/messageHandler.js");
  assert.ok(source.indexOf('"/acervo", "/dardos"') < source.indexOf("const club = await getOrCreateClub(message)"));
  assert.match(source, /if \(!isGroupChat\(message\.chat\)\) return;/);
});

test("catálogo revalida autorização global e restringe exclusões ao privado", () => {
  const handler = read("src/handlers/messageHandler.js");
  const callback = read("src/handlers/dartCatalogCallbackHandler.js");
  const upload = read("src/services/dartCatalogUploadService.js");
  assert.doesNotMatch(handler, /Administre o catálogo no privado do bot/);
  assert.match(callback, /chat\.type !== "private"/);
  assert.match(handler, /canManageBot\(user\)/);
  assert.match(callback, /canManageBot\(user\)/);
  assert.match(upload, /canManageBot\(adminUser\)/);
});

test("callback de dardos usa DartPlayer e não cria ClubMember", () => {
  const source = read("src/handlers/dartGameCallbackHandler.js");
  assert.match(source, /consumeDart\(user\)/);
  assert.doesNotMatch(source, /ClubMember|getOrCreateClub/);
});

test("XP e ranking permanecem filtrados por clubId", () => {
  assert.match(read("src/commands/rankCommand.js"), /clubId: club\.id/);
  assert.match(read("src/services/adminXpService.js"), /clubId: club\.id/);
});

test("backfill escolhe MIN do saldo efetivo sem remover dados na mesma migration", () => {
  const backfill = read("src/database/migrations/20260814190200-create-and-backfill-dart-players.js");
  assert.match(backfill, /MIN\(CASE/);
  assert.match(backfill, /LEAST\(3, GREATEST\(0, "dartsAvailable"\)\)/);
  assert.doesNotMatch(backfill, /removeColumn/);
  const cleanup = read("src/database/migrations/20260814190300-remove-darts-from-club-members.js");
  assert.match(cleanup, /removeColumn\("club_members", "dartsAvailable"/);
});

test("migration do catálogo aborta e diagnostica duplicatas antes de remover clubId", () => {
  const source = read("src/database/migrations/20260814190100-globalize-franchises.js");
  assert.ok(source.indexOf("conflicts.length") < source.indexOf('removeColumn("franchises", "clubId"'));
  assert.match(source, /HAVING count\(\*\) > 1/);
});
