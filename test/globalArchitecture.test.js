const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { refreshPlayerForDay, getDartPlayer, consumeDart } = require("../src/services/dartGameService");
const { sequelize, DartPlayer } = require("../src/database/models");

const read = (relative) => fs.readFileSync(path.join(__dirname, "..", relative), "utf8");

test("nenhum período completo preserva qualquer saldo existente", () => {
  for (const balance of [0, 3, 16, 18]) {
    const player = { dartsAvailable: balance, dartsRefreshedOn: "2026-08-17" };
    assert.equal(refreshPlayerForDay(player, "2026-08-17"), false);
    assert.equal(player.dartsAvailable, balance);
    assert.equal(player.dartsRefreshedOn, "2026-08-17");
  }
});

test("um período adiciona três ao saldo em vez de redefini-lo", () => {
  for (const [current, expected] of [[0, 3], [2, 5], [16, 19], [17, 20]]) {
    const player = { dartsAvailable: current, dartsRefreshedOn: "2026-08-14" };
    assert.equal(refreshPlayerForDay(player, "2026-08-15"), true);
    assert.equal(player.dartsAvailable, expected);
    assert.equal(player.dartsRefreshedOn, "2026-08-15");
  }
});

test("todos os períodos ausentes são creditados sem teto", () => {
  for (const [current, days, expected] of [[5, 2, 11], [0, 4, 12], [0, 6, 18]]) {
    const player = { dartsAvailable: current, dartsRefreshedOn: "2026-08-14" };
    const target = new Date(Date.UTC(2026, 7, 14 + days)).toISOString().slice(0, 10);
    assert.equal(refreshPlayerForDay(player, target), true);
    assert.equal(player.dartsAvailable, expected);
    assert.equal(player.dartsRefreshedOn, target);
  }
});

test("o mesmo período não recebe crédito duas vezes", () => {
  const player = { dartsAvailable: 2, dartsRefreshedOn: "2026-08-14" };
  assert.equal(refreshPlayerForDay(player, "2026-08-15"), true);
  assert.equal(refreshPlayerForDay(player, "2026-08-15"), false);
  assert.equal(player.dartsAvailable, 5);
});

async function withLockedPlayer(player, action) {
  const originalTransaction = sequelize.transaction;
  const originalFindOrCreate = DartPlayer.findOrCreate;
  let lockTail = Promise.resolve();
  sequelize.transaction = async (callback) => {
    const transaction = { LOCK: { UPDATE: "UPDATE" }, release: null };
    try {
      return await callback(transaction);
    } finally {
      transaction.release?.();
    }
  };
  DartPlayer.findOrCreate = async () => [player, false];
  player.reload = async ({ transaction }) => {
    const previous = lockTail;
    lockTail = new Promise((resolve) => { transaction.release = resolve; });
    await previous;
  };
  player.save = async () => player;
  try {
    await action();
  } finally {
    sequelize.transaction = originalTransaction;
    DartPlayer.findOrCreate = originalFindOrCreate;
  }
}

test("refresh simultâneo concede cada período uma única vez", async () => {
  const player = { dartsAvailable: 2, dartsRefreshedOn: "2026-08-14" };
  await withLockedPlayer(player, async () => {
    const date = new Date("2026-08-15T12:00:00-03:00");
    await Promise.all([getDartPlayer({ id: 1 }, date), getDartPlayer({ id: 1 }, date)]);
  });
  assert.equal(player.dartsAvailable, 5);
});

test("consumo simultâneo ao refresh preserva o total correto", async () => {
  const player = { dartsAvailable: 2, dartsRefreshedOn: "2026-08-14" };
  await withLockedPlayer(player, async () => {
    const date = new Date("2026-08-15T12:00:00-03:00");
    await Promise.all([getDartPlayer({ id: 1 }, date), consumeDart({ id: 1 }, date)]);
  });
  assert.equal(player.dartsAvailable, 4);
});

test("consumo reduz exatamente uma exploração acumulada", async () => {
  const player = { dartsAvailable: 18, dartsRefreshedOn: "2026-08-15" };
  await withLockedPlayer(player, async () => {
    const result = await consumeDart({ id: 1 }, new Date("2026-08-15T12:00:00-03:00"));
    assert.equal(result.remainingDarts, 17);
  });
  assert.equal(player.dartsAvailable, 17);
});

test("fração do período atual não é creditada nem adia a próxima renovação", () => {
  const player = { dartsAvailable: 2, dartsRefreshedOn: "2026-08-14" };
  assert.equal(refreshPlayerForDay(player, "2026-08-14"), false);
  assert.equal(player.dartsRefreshedOn, "2026-08-14");
  assert.equal(refreshPlayerForDay(player, "2026-08-15"), true);
  assert.equal(player.dartsAvailable, 5);
  assert.equal(player.dartsRefreshedOn, "2026-08-15");
});

test("jogador sem marco inicial preserva saldo e inicia o período sem crédito duplicado", () => {
  const player = { dartsAvailable: 3, dartsRefreshedOn: null };
  assert.equal(refreshPlayerForDay(player, "2026-08-15"), true);
  assert.equal(player.dartsAvailable, 3);
  assert.equal(refreshPlayerForDay(player, "2026-08-15"), false);
  assert.equal(player.dartsAvailable, 3);
});

test("novo jogador começa com três e já recebe o marco do período atual", () => {
  const service = read("src/services/dartGameService.js");
  const model = read("src/database/models/DartPlayer.js");
  assert.match(service, /defaults: \{ dartsAvailable: DARTS_PER_DAY, dartsRefreshedOn: getDartDay\(\) \}/);
  assert.match(model, /defaultValue: DARTS_PER_DAY/);
});

test("refresh e consumo permanecem transacionais e protegidos por linha", () => {
  const source = read("src/services/dartGameService.js");
  assert.match(source, /sequelize\.transaction/);
  assert.match(source, /lock: transaction\.LOCK\.UPDATE/);
  assert.match(source, /player\.dartsAvailable \+= elapsedDays \* DARTS_PER_DAY/);
  assert.match(source, /player\.dartsAvailable -= 1/);
});

test("mensagens do acervo descrevem saldo acumulável", () => {
  const command = read("src/commands/dartsCommand.js");
  const callback = read("src/handlers/dartGameCallbackHandler.js");
  const help = read("src/commands/helpCommand.js");
  assert.doesNotMatch(`${command}\n${callback}`, /explorações (?:disponíveis |restantes )?hoje/i);
  assert.doesNotMatch(`${command}\n${callback}`, /encerrou suas explorações por hoje/i);
  assert.match(help, /três explorações por dia/i);
  assert.match(help, /não utilizadas ficam acumuladas/i);
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

test("saldo do acervo é global entre tipos de chat", () => {
  const model = read("src/database/models/DartPlayer.js");
  const service = read("src/services/dartGameService.js");
  assert.match(model, /userId: \{ type: DataTypes\.INTEGER, allowNull: false, unique: true \}/);
  assert.match(service, /where: \{ userId \}/);
  assert.doesNotMatch(service, /chatId|ClubMember|clubId/);
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
