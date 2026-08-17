function parseBotOwnerId(value) {
  const normalized = String(value ?? "").trim();

  if (!/^\d+$/.test(normalized) || normalized === "0") {
    throw new Error(
      "BOT_OWNER_ID ausente ou inválido. Informe o ID numérico do owner do bot.",
    );
  }

  return normalized.replace(/^0+(?=\d)/, "");
}

function getBotOwnerId() {
  return parseBotOwnerId(process.env.BOT_OWNER_ID);
}

module.exports = {
  parseBotOwnerId,
  getBotOwnerId,
};
