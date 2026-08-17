const test = require("node:test");
const assert = require("node:assert/strict");
const { parseBotOwnerId } = require("../src/config/botOwnerConfig");

test("valida e normaliza BOT_OWNER_ID", () => {
  assert.equal(parseBotOwnerId("001234"), "1234");
});

test("recusa BOT_OWNER_ID ausente ou inválido", () => {
  for (const value of [undefined, "", "abc", "-1", "0", "12.3"]) {
    assert.throws(() => parseBotOwnerId(value), /BOT_OWNER_ID/);
  }
});
