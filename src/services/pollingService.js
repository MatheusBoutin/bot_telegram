const { telegramRequest } = require("../telegram");

const { handleMessage } = require("../handlers/messageHandler");

const {
  POLLING_TIMEOUT_SECONDS,
  POLLING_BASE_RETRY_DELAY_MS,
  POLLING_MAX_RETRY_DELAY_MS,
  UPDATE_MAX_ATTEMPTS,
  UPDATE_RETRY_DELAY_MS,
} = require("../config/pollingConfig");

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function waitWhileRunning(milliseconds, shouldContinue) {
  const interval = 250;
  let remainingTime = milliseconds;

  while (remainingTime > 0 && shouldContinue()) {
    const currentInterval = Math.min(interval, remainingTime);

    await delay(currentInterval);

    remainingTime -= currentInterval;
  }
}

function calculatePollingRetryDelay(consecutiveErrors) {
  const errorCount = Math.max(1, consecutiveErrors);

  const exponentialDelay = POLLING_BASE_RETRY_DELAY_MS * 2 ** (errorCount - 1);

  return Math.min(exponentialDelay, POLLING_MAX_RETRY_DELAY_MS);
}

function getPollingRetryDelay(error, consecutiveErrors) {
  const telegramRetryDelay = Number(error?.retryAfterMs);

  if (Number.isFinite(telegramRetryDelay) && telegramRetryDelay > 0) {
    return telegramRetryDelay;
  }

  return calculatePollingRetryDelay(consecutiveErrors);
}

function formatError(error) {
  const message = error instanceof Error ? error.message : String(error);

  if (!error?.code) {
    return message;
  }

  return `${message} [código: ${error.code}]`;
}

async function processUpdateWithRetry(update, shouldContinue) {
  if (!update.message) {
    return true;
  }

  for (let attempt = 1; attempt <= UPDATE_MAX_ATTEMPTS; attempt++) {
    if (!shouldContinue()) {
      return false;
    }

    try {
      await handleMessage(update.message);
      return true;
    } catch (error) {
      console.error(
        `Erro ao processar update ${update.update_id}. ` +
          `Tentativa ${attempt}/${UPDATE_MAX_ATTEMPTS}: ` +
          formatError(error),
      );

      const hasAnotherAttempt = attempt < UPDATE_MAX_ATTEMPTS;

      if (hasAnotherAttempt) {
        await waitWhileRunning(UPDATE_RETRY_DELAY_MS, shouldContinue);
      }
    }
  }

  console.error(
    `Update ${update.update_id} ignorado após ` +
      `${UPDATE_MAX_ATTEMPTS} tentativas.`,
  );

  return false;
}

async function runPolling(shouldContinue = () => true) {
  let offset = 0;
  let consecutivePollingErrors = 0;

  console.log("Bot ligado e aguardando mensagens.");

  while (shouldContinue()) {
    let updates;

    try {
      updates = await telegramRequest("getUpdates", {
        offset: offset,
        timeout: POLLING_TIMEOUT_SECONDS,
      });

      if (!Array.isArray(updates)) {
        throw new TypeError(
          "O Telegram não retornou uma lista de atualizações.",
        );
      }

      if (consecutivePollingErrors > 0) {
        console.log("Conexão com o Telegram restabelecida. Polling retomado.");
      }

      consecutivePollingErrors = 0;
    } catch (error) {
      if (!shouldContinue()) {
        break;
      }

      consecutivePollingErrors += 1;

      const retryDelay = getPollingRetryDelay(error, consecutivePollingErrors);

      const retrySeconds = Math.ceil(retryDelay / 1000);

      console.error("Erro no polling do Telegram: " + formatError(error));

      console.log(`Nova tentativa em ${retrySeconds} segundos.`);

      await waitWhileRunning(retryDelay, shouldContinue);

      continue;
    }

    for (const update of updates) {
      if (!shouldContinue()) {
        break;
      }

      await processUpdateWithRetry(update, shouldContinue);
      offset = update.update_id + 1;
    }
  }
}

module.exports = {
  runPolling,
  calculatePollingRetryDelay,
};
