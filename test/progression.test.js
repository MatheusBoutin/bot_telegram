const test = require("node:test");
const assert = require("node:assert/strict");

const {
  generateXp,
  getXpRequiredForNextLevel,
  calculateLevel,
  addXp,
} = require("../src/services/xpService");
const { getTitle, getUnlockedTitle } = require("../src/services/titleService");

test("gera XP entre 3 e 7", () => {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const xp = generateXp();
    assert.ok(xp >= 3);
    assert.ok(xp <= 7);
  }
});

test("a exigência aumenta por nível", () => {
  const expectations = [
    [1, 400], [10, 1300], [20, 2300],
    [30, 3300], [40, 4300], [49, 5200],
  ];
  for (const [level, requiredXp] of expectations) {
    assert.equal(getXpRequiredForNextLevel(level), requiredXp);
  }
});

test("calcula corretamente os níveis", () => {
  const expectations = [
    [0, 1], [399, 1], [400, 2], [899, 2], [900, 3],
    [7199, 9], [7200, 10], [8499, 10], [8500, 11],
    [24699, 19], [24700, 20], [26999, 20], [27000, 21],
    [52199, 29], [52200, 30], [55499, 30], [55500, 31],
    [89699, 39], [89700, 40], [93999, 40], [94000, 41],
    [137199, 49], [137200, 50], [999999, 50],
  ];
  for (const [xp, level] of expectations) {
    assert.equal(calculateLevel(xp), level, `${xp} XP`);
  }
});

test("retorna os títulos corretos", () => {
  const expectations = [
    [1, "Iniciante Literary"], [10, "Iniciante Literary"],
    [11, "Leitor Ativo"], [20, "Leitor Ativo"],
    [21, "Book Lover"], [30, "Book Lover"],
    [31, "Bibliotecário"], [40, "Bibliotecário"],
    [41, "Ícone do Squad"], [50, "Ícone do Squad"],
  ];
  for (const [level, title] of expectations) {
    assert.equal(getTitle(level), title);
  }
});

test("anuncia título somente ao entrar em uma nova faixa", () => {
  assert.equal(getUnlockedTitle(10, 11), "Leitor Ativo");
  assert.equal(getUnlockedTitle(20, 21), "Book Lover");
  assert.equal(getUnlockedTitle(30, 31), "Bibliotecário");
  assert.equal(getUnlockedTitle(40, 41), "Ícone do Squad");
  assert.equal(getUnlockedTitle(1, 2), null);
  assert.equal(getUnlockedTitle(11, 12), null);
  assert.equal(getUnlockedTitle(21, 30), null);
  assert.equal(getUnlockedTitle(31, 40), null);
  assert.equal(getUnlockedTitle(41, 50), null);
});

test("XP altera somente o membro recebido", async () => {
  const memberA = {
    xp: 0, level: 1, messageCount: 0,
    lastXpAt: 0, lastMessage: "", lastMessageAt: 0,
    async save() {},
  };
  const memberB = { xp: 50, level: 1, messageCount: 10 };

  await addXp(memberA, { text: "Mensagem válida no grupo A" });

  assert.ok(memberA.xp >= 3);
  assert.ok(memberA.xp <= 7);
  assert.equal(memberA.messageCount, 1);
  assert.equal(memberB.xp, 50);
  assert.equal(memberB.messageCount, 10);
});
