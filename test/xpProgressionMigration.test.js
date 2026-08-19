const test = require("node:test");
const assert = require("node:assert/strict");

const migration = require(
  "../src/database/migrations/20260819000000-recalculate-club-member-levels",
);

function createQueryInterface(members) {
  const transaction = { id: "test-transaction" };
  const calls = [];
  return {
    calls,
    sequelize: {
      async transaction(callback) { return callback(transaction); },
      async query(sql, options) {
        calls.push({ sql, options });
        const { baseLevelXp, levelXpIncrease } = options.replacements;
        for (const member of members) {
          let level = 1;
          let accumulatedXp = 0;
          while (level < 50) {
            accumulatedXp += baseLevelXp + (level - 1) * levelXpIncrease;
            if (member.xp < accumulatedXp) break;
            level += 1;
          }
          member.level = level;
        }
      },
    },
  };
}

test("migration recalcula níveis sem alterar XP, grupo ou registros", async () => {
  const members = [
    { id: 1, clubId: 10, xp: 399, level: 8 },
    { id: 2, clubId: 10, xp: 400, level: 20 },
    { id: 3, clubId: 20, xp: 137200, level: 1 },
    { id: 4, clubId: 20, xp: 999999, level: 1 },
  ];
  const identities = members.map(({ id, clubId, xp }) => ({ id, clubId, xp }));
  const queryInterface = createQueryInterface(members);

  await migration.up(queryInterface);

  assert.deepEqual(members.map(({ id, clubId, xp }) => ({ id, clubId, xp })), identities);
  assert.deepEqual(members.map(({ level }) => level), [1, 2, 50, 50]);
  assert.equal(members.length, 4);
  assert.equal(queryInterface.calls.length, 1);
  assert.match(queryInterface.calls[0].sql, /^UPDATE club_members/m);
  assert.match(queryInterface.calls[0].sql, /SET level = LEAST/);
  assert.doesNotMatch(queryInterface.calls[0].sql, /\b(DELETE|INSERT|DROP|ALTER)\b/i);
  assert.equal(queryInterface.calls[0].options.transaction.id, "test-transaction");
  assert.deepEqual(queryInterface.calls[0].options.replacements, {
    baseLevelXp: 400,
    levelXpIncrease: 100,
  });
});

test("down restaura os níveis conforme a progressão anterior", async () => {
  const members = [
    { id: 1, clubId: 10, xp: 34300, level: 1 },
    { id: 2, clubId: 20, xp: 999999, level: 1 },
  ];
  const queryInterface = createQueryInterface(members);

  await migration.down(queryInterface);

  assert.deepEqual(members.map(({ level }) => level), [50, 50]);
  assert.deepEqual(queryInterface.calls[0].options.replacements, {
    baseLevelXp: 100,
    levelXpIncrease: 25,
  });
});
