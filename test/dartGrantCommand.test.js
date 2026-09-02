const test = require("node:test");
const assert = require("node:assert/strict");
const { parseGrant } = require("../src/commands/grantDartsCommand");

const groupMessage = (text, reply = { from: { id: 77, first_name: "Pessoa" } }) => ({
  text, chat: { type: "supergroup", id: -100 }, reply_to_message: reply,
});

test("concessão em grupo exige resposta e usa somente o ID da resposta", () => {
  assert.deepEqual(parseGrant(groupMessage("/daracervos 5 evento")), { targetId: "77", amount: 5, reason: "evento" });
  assert.match(parseGrant(groupMessage("/daracervos 5", null)).error, /Responda à mensagem/);
});

test("concessão privada aceita ID conhecido em vez de nome ou username", () => {
  assert.deepEqual(parseGrant({ text: "/daracervos 123456789 5 evento", chat: { type: "private" } }), { targetId: "123456789", amount: 5, reason: "evento" });
  assert.match(parseGrant({ text: "/daracervos @pessoa 5", chat: { type: "private" } }).error, /ID numérico/);
  assert.match(parseGrant({ text: "/daracervos Pessoa 5", chat: { type: "private" } }).error, /ID numérico/);
});

test("quantidade inválida e motivo acima do limite são rejeitados", () => {
  for (const amount of ["0", "-1", "1.5", "NaN", "Infinity", "texto", "9007199254740992"]) {
    assert.match(parseGrant(groupMessage(`/daracervos ${amount}`)).error, /quantidade|limite/i);
  }
  assert.match(parseGrant(groupMessage(`/daracervos 1 ${"x".repeat(201)}`)).error, /motivo.*200/i);
});
