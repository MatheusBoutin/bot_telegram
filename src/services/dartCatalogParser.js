const {
  DART_RARITIES,
  DART_RARITY_LABELS,
  FRANCHISE_NAME_MAX_LENGTH,
  CHARACTER_NAME_MAX_LENGTH,
  CHARACTER_DESCRIPTION_MAX_LENGTH,
} = require("../config/dartConfig");

const rarityAliases = Object.freeze({
  comum: "common",
  common: "common",

  incomum: "uncommon",
  uncommon: "uncommon",

  raro: "rare",
  rara: "rare",
  rare: "rare",

  epico: "epic",
  epica: "epic",
  epic: "epic",

  lendario: "legendary",
  lendaria: "legendary",
  legendary: "legendary",
});

function normalizeCatalogText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function parseFranchiseName(text) {
  const trimmedText = text.trim();
  const commandEnd = trimmedText.search(/\s/);

  if (commandEnd === -1) {
    return {
      ok: false,
      error: "Informe o nome da franquia.",
    };
  }

  const name = trimmedText.slice(commandEnd).trim().replace(/\s+/g, " ");

  if (!name) {
    return {
      ok: false,
      error: "Informe o nome da franquia.",
    };
  }

  if (name.length > FRANCHISE_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error:
        `O nome da franquia pode ter no máximo ` +
        `${FRANCHISE_NAME_MAX_LENGTH} caracteres.`,
    };
  }

  return {
    ok: true,
    name,
    normalizedName: normalizeCatalogText(name),
  };
}

function parseRarity(value) {
  const normalizedRarity = normalizeCatalogText(value);

  const rarity = rarityAliases[normalizedRarity];

  if (!rarity || !DART_RARITIES.includes(rarity)) {
    return null;
  }

  return rarity;
}

function getCaptionFormatHelp() {
  return [
    "Use um destes formatos:",
    "",
    "Nome / raridade / descrição",
    "Nome | raridade | descrição",
    "",
    "Exemplos:",
    "Gimli / lendário / Filho de Glóin.",
    "Gimli | lendário | Filho de Glóin.",
  ].join("\n");
}

function parseCharacterCaption(caption) {
  if (typeof caption !== "string" || !caption.trim()) {
    return {
      ok: false,
      error: "Adicione uma legenda na imagem.\n\n" + getCaptionFormatHelp(),
    };
  }

  const captionMatch = caption
    .trim()
    .match(/^(.+?)\s*(?:\/|\|)\s*(.+?)\s*(?:\/|\|)\s*([\s\S]+)$/);

  if (!captionMatch) {
    return {
      ok: false,
      error:
        "A legenda está em um formato inválido.\n\n" + getCaptionFormatHelp(),
    };
  }

  const name = captionMatch[1].trim().replace(/\s+/g, " ");

  const rarityText = captionMatch[2].trim();

  const description = captionMatch[3].trim();

  if (!name || !rarityText || !description) {
    return {
      ok: false,
      error:
        "Nome, raridade e descrição são obrigatórios.\n\n" +
        getCaptionFormatHelp(),
    };
  }

  if (name.length > CHARACTER_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error:
        `O nome pode ter no máximo ` +
        `${CHARACTER_NAME_MAX_LENGTH} caracteres.`,
    };
  }

  if (description.length > CHARACTER_DESCRIPTION_MAX_LENGTH) {
    return {
      ok: false,
      error:
        `A descrição pode ter no máximo ` +
        `${CHARACTER_DESCRIPTION_MAX_LENGTH} caracteres.`,
    };
  }

  const rarity = parseRarity(rarityText);

  if (!rarity) {
    const acceptedRarities = DART_RARITIES.map((item) => {
      return DART_RARITY_LABELS[item];
    }).join(", ");

    return {
      ok: false,
      error: `Raridade inválida. Use uma destas: ` + `${acceptedRarities}.`,
    };
  }

  return {
    ok: true,
    name,
    normalizedName: normalizeCatalogText(name),
    rarity,
    description,
  };
}

module.exports = {
  normalizeCatalogText,
  parseFranchiseName,
  parseCharacterCaption,
};
