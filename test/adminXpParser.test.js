const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseXpChangeCommand,
  parseUndoXpCommand,
} = require("../src/services/adminXpParser");

test("interpreta uma recompensa com motivo", () => {
  const result = parseXpChangeCommand("/darxp 100 Participou do encontro", {
    allowNegative: false,
  });

  assert.deepEqual(result, {
    ok: true,
    amount: 100,
    reason: "Participou do encontro",
  });
});

test("aceita ajuste negativo", () => {
  const result = parseXpChangeCommand("/ajustarxp -50 Correção de recompensa", {
    allowNegative: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.amount, -50);
});

test("rejeita recompensa negativa", () => {
  const result = parseXpChangeCommand("/darxp -50 Teste", {
    allowNegative: false,
  });

  assert.equal(result.ok, false);
});

test("rejeita alteração sem motivo", () => {
  const result = parseXpChangeCommand("/darxp 100", {
    allowNegative: false,
  });

  assert.equal(result.ok, false);
});

test("interpreta o ID da transação que será desfeita", () => {
  const transactionId = 1;

  const result = parseUndoXpCommand(
    `/desfazerxp ${transactionId} Recompensa duplicada`,
  );

  assert.deepEqual(result, {
    ok: true,
    transactionId,
    reason: "Recompensa duplicada",
  });
});
