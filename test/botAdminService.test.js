const test = require("node:test");
const assert = require("node:assert/strict");
const { BotAdmin } = require("../src/database/models");
const service = require("../src/services/botAdminService");

test("owner é reconhecido implicitamente e nunca pode ser revogado", { concurrency: false }, async () => {
  const previous = process.env.BOT_OWNER_ID;
  process.env.BOT_OWNER_ID = "123";
  try {
    const owner = { id: 1, telegramId: "123" };
    assert.equal(service.isOwner(owner), true);
    assert.deepEqual(await service.revokeBotAdmin(owner, { id: 2 }), { changed: false, owner: true });
  } finally {
    if (previous === undefined) delete process.env.BOT_OWNER_ID;
    else process.env.BOT_OWNER_ID = previous;
  }
});

test("concessão reativa registro e revogação é idempotente", { concurrency: false }, async () => {
  const previousOwner = process.env.BOT_OWNER_ID;
  process.env.BOT_OWNER_ID = "999";
  const originalFindOrCreate = BotAdmin.findOrCreate;
  const originalFindOne = BotAdmin.findOne;
  const record = { active: false, async update(values) { Object.assign(this, values); } };
  try {
    BotAdmin.findOrCreate = async () => [record, false];
    let result = await service.grantBotAdmin({ id: 3, telegramId: "3" }, { id: 1 });
    assert.equal(result.changed, true);
    assert.equal(record.active, true);
    BotAdmin.findOne = async () => record;
    result = await service.revokeBotAdmin({ id: 3, telegramId: "3" }, { id: 1 });
    assert.equal(result.changed, true);
    assert.equal(record.active, false);
    result = await service.revokeBotAdmin({ id: 3, telegramId: "3" }, { id: 1 });
    assert.equal(result.changed, false);
  } finally {
    BotAdmin.findOrCreate = originalFindOrCreate;
    BotAdmin.findOne = originalFindOne;
    if (previousOwner === undefined) delete process.env.BOT_OWNER_ID;
    else process.env.BOT_OWNER_ID = previousOwner;
  }
});

test("usuário normal não possui autorização global e revogação remove acesso imediato", { concurrency: false }, async () => {
  const previousOwner = process.env.BOT_OWNER_ID;
  process.env.BOT_OWNER_ID = "999";
  const originalFindOne = BotAdmin.findOne;
  try {
    let active = true;
    BotAdmin.findOne = async ({ where }) => where.active && active ? { active: true } : null;
    const user = { id: 7, telegramId: "7" };
    assert.equal(await service.canManageBot(user), true);
    active = false;
    assert.equal(await service.canManageBot(user), false);
  } finally {
    BotAdmin.findOne = originalFindOne;
    if (previousOwner === undefined) delete process.env.BOT_OWNER_ID;
    else process.env.BOT_OWNER_ID = previousOwner;
  }
});
