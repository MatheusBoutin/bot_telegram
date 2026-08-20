const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeCatalogText,
  parseFranchiseName,
  parseCharacterCaption,
} = require("../src/services/dartCatalogParser");

test("normaliza acentos e espaços para evitar franquias duplicadas", () => {
  assert.equal(
    normalizeCatalogText("  Senhor   dos Anéis "),
    "senhor dos aneis",
  );
});

test("lê o nome completo da franquia depois do comando", () => {
  const result = parseFranchiseName("/criarfranquia Senhor dos Anéis");

  assert.deepEqual(result, {
    ok: true,
    name: "Senhor dos Anéis",
    normalizedName: "senhor dos aneis",
  });
});

test("lê personagem, raridade e descrição da legenda", () => {
  const result = parseCharacterCaption(
    "Gimli | lendário | Filho de Glóin e membro da Sociedade do Anel.",
  );

  assert.deepEqual(result, {
    ok: true,
    name: "Gimli",
    normalizedName: "gimli",
    rarity: "legendary",
    description: "Filho de Glóin e membro da Sociedade do Anel.",
  });
});

test("aceita raridade sem acento", () => {
  const result = parseCharacterCaption("Gimli | lendario | Filho de Glóin.");

  assert.equal(result.ok, true);
  assert.equal(result.rarity, "legendary");
});

test("recusa legenda sem descrição", () => {
  const result = parseCharacterCaption("Gimli | lendário");

  assert.equal(result.ok, false);
});

test("recusa uma raridade inexistente", () => {
  const result = parseCharacterCaption("Gimli | mítico | Filho de Glóin.");

  assert.equal(result.ok, false);
});

test("aceita descrição de até 1200 caracteres", () => {
  const result = parseCharacterCaption(`Gimli | lendário | ${"a".repeat(1200)}`);

  assert.equal(result.ok, true);
  assert.equal(result.description.length, 1200);
});

test("recusa descrição acima de 1200 caracteres", () => {
  const result = parseCharacterCaption(`Gimli | lendário | ${"a".repeat(1201)}`);

  assert.equal(result.ok, false);
  assert.match(result.error, /1200 caracteres/);
});
