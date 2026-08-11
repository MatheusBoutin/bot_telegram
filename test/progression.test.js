const test = require("node:test");
const assert = require("node:assert/strict");

const {
  generateXp,
  getXpRequiredForNextLevel,
  calculateLevel,
  addXp,
} = require("../src/services/xpService");

const { getTitle } = require("../src/services/titleService");

test("gera XP entre 3 e 7", () => {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const xp = generateXp();

    assert.ok(xp >= 3);
    assert.ok(xp <= 7);
  }
});

test("a exigência aumenta por nível", () => {
  assert.equal(getXpRequiredForNextLevel(1), 100);
  assert.equal(getXpRequiredForNextLevel(2), 125);
  assert.equal(getXpRequiredForNextLevel(10), 325);
});

test("calcula corretamente os níveis", () => {
  assert.equal(calculateLevel(0), 1);
  assert.equal(calculateLevel(99), 1);
  assert.equal(calculateLevel(100), 2);
  assert.equal(calculateLevel(224), 2);
  assert.equal(calculateLevel(225), 3);
  assert.equal(calculateLevel(34299), 49);
  assert.equal(calculateLevel(34300), 50);
  assert.equal(calculateLevel(999999), 50);
});

test("retorna os títulos corretos", () => {
  assert.equal(getTitle(1), "Aprendiz");
  assert.equal(getTitle(5), "Iniciado");
  assert.equal(getTitle(25), "Magíster");
  assert.equal(getTitle(50), "Sábio da Biblioteca");
});

test("XP altera somente o membro recebido", async () => {
  const memberA = {
    xp: 0,
    level: 1,
    messageCount: 0,
    lastXpAt: 0,
    lastMessage: "",
    lastMessageAt: 0,

    async save() {},
  };

  const memberB = {
    xp: 50,
    level: 1,
    messageCount: 10,
  };

  await addXp(memberA, {
    text: "Mensagem válida no grupo A",
  });

  assert.ok(memberA.xp >= 3);
  assert.ok(memberA.xp <= 7);
  assert.equal(memberA.messageCount, 1);

  assert.equal(memberB.xp, 50);
  assert.equal(memberB.messageCount, 10);
});
