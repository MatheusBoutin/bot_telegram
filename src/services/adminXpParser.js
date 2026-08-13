const {
  MAX_ADMIN_XP_CHANGE,
  XP_REASON_MAX_LENGTH,
} = require("../config/adminXpConfig");

const { getCommandArguments } = require("./commandService");

function validateReason(reason) {
  if (!reason) {
    return "Informe o motivo da alteração.";
  }

  if (reason.length > XP_REASON_MAX_LENGTH) {
    return (
      `O motivo pode ter no máximo ` + `${XP_REASON_MAX_LENGTH} caracteres.`
    );
  }

  return null;
}

function parseXpChangeCommand(text, { allowNegative }) {
  const [amountText, ...reasonParts] = getCommandArguments(text);

  if (!amountText || !/^[+-]?\d+$/.test(amountText)) {
    return {
      ok: false,
      error: "Informe uma quantidade inteira de XP.",
    };
  }

  const amount = Number(amountText);

  if (!Number.isSafeInteger(amount) || amount === 0) {
    return {
      ok: false,
      error:
        "A quantidade de XP precisa ser um número inteiro diferente de zero.",
    };
  }

  if (!allowNegative && amount < 0) {
    return {
      ok: false,
      error: "O /darxp aceita somente valores positivos.",
    };
  }

  if (Math.abs(amount) > MAX_ADMIN_XP_CHANGE) {
    return {
      ok: false,
      error:
        `O limite por comando é de ` +
        `${MAX_ADMIN_XP_CHANGE} XP para mais ou para menos.`,
    };
  }

  const reason = reasonParts.join(" ").trim();
  const reasonError = validateReason(reason);

  if (reasonError) {
    return {
      ok: false,
      error: reasonError,
    };
  }

  return {
    ok: true,
    amount,
    reason,
  };
}

function parseUndoXpCommand(text) {
  const [transactionIdText, ...reasonParts] = getCommandArguments(text);

  if (!transactionIdText || !/^\d+$/.test(transactionIdText)) {
    return {
      ok: false,
      error: "Informe o número da transação que será desfeita.",
    };
  }

  const transactionId = Number(transactionIdText);

  if (!Number.isSafeInteger(transactionId) || transactionId <= 0) {
    return {
      ok: false,
      error: "O número da transação é inválido.",
    };
  }

  const reason = reasonParts.join(" ").trim();
  const reasonError = validateReason(reason);

  if (reasonError) {
    return {
      ok: false,
      error: reasonError,
    };
  }

  return {
    ok: true,
    transactionId,
    reason,
  };
}

module.exports = {
  parseXpChangeCommand,
  parseUndoXpCommand,
};
