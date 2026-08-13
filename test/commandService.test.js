const test = require("node:test");
const assert = require("node:assert/strict");

const { getCommandName } = require("../src/services/commandService");

test("identifica um comando simples", () => {
  assert.equal(getCommandName("/darxp 100 motivo"), "/darxp");
});

test("remove o nome do bot de comandos usados em grupos", () => {
  assert.equal(getCommandName("/darxp@MeuBot 100 motivo"), "/darxp");
});

test("retorna null para uma mensagem comum", () => {
  assert.equal(getCommandName("Olá, clube!"), null);
});
