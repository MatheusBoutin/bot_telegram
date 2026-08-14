const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getDartDay,
  chooseWeightedCharacter,
} = require("../src/services/dartGameService");

test("usa o dia de São Paulo para renovar os dardos", () => {
  const instant = new Date("2026-08-14T02:30:00.000Z");

  assert.equal(getDartDay(instant), "2026-08-13");
});

test("o sorteio ponderado respeita a raridade", () => {
  const common = {
    id: 1,
    name: "Hobbit da Vila",
    rarity: "common",
  };

  const legendary = {
    id: 2,
    name: "Gimli",
    rarity: "legendary",
  };

  assert.equal(
    chooseWeightedCharacter([common, legendary], () => 0),
    common,
  );

  assert.equal(
    chooseWeightedCharacter([common, legendary], () => 0.999),
    legendary,
  );
});

test("não sorteia quando não há personagens", () => {
  assert.equal(chooseWeightedCharacter([]), null);
});
