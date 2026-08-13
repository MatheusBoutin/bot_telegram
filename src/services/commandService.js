function getCommandName(text) {
  if (typeof text !== "string") {
    return null;
  }

  const trimmedText = text.trim();

  if (!trimmedText.startsWith("/")) {
    return null;
  }

  const firstPart = trimmedText.split(/\s+/, 1)[0];

  return firstPart.split("@")[0].toLowerCase();
}

function getCommandArguments(text) {
  if (typeof text !== "string") {
    return [];
  }

  const parts = text.trim().split(/\s+/);

  return parts.slice(1);
}

module.exports = {
  getCommandName,
  getCommandArguments,
};
