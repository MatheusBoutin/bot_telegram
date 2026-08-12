const https = require("node:https");

const { TELEGRAM_REQUEST_TIMEOUT_MS } = require("./config/pollingConfig");

require("dotenv").config({
  quiet: true,
});

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("O token do Telegram não foi encontrado no arquivo .env.");
}

function createTelegramError(data, method, statusCode) {
  let errorMessage = `Erro ao executar o método ${method}.`;

  if (data && data.description) {
    errorMessage = data.description;
  }

  const error = new Error(errorMessage);

  if (data && data.error_code) {
    error.code = data.error_code;
  } else if (statusCode) {
    error.code = statusCode;
  }

  const retryAfterSeconds = Number(data?.parameters?.retry_after);

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    error.retryAfterMs = retryAfterSeconds * 1000;
  }

  return error;
}

function telegramRequest(method, body = null) {
  return new Promise((resolve, reject) => {
    let httpMethod = "GET";
    let requestBody = null;

    if (body) {
      httpMethod = "POST";
      requestBody = JSON.stringify(body);
    }

    const options = {
      hostname: "api.telegram.org",
      port: 443,
      path: `/bot${token}/${method}`,
      method: httpMethod,

      // Mantemos IPv4 porque sua rede precisou disso.
      family: 4,

      headers: {
        Accept: "application/json",
      },
    };

    if (requestBody) {
      options.headers["Content-Type"] = "application/json";

      options.headers["Content-Length"] = Buffer.byteLength(requestBody);
    }

    const request = https.request(options, (response) => {
      let responseBody = "";

      response.setEncoding("utf8");

      response.on("data", (chunk) => {
        responseBody += chunk;
      });

      response.on("aborted", () => {
        reject(new Error("A conexão com o Telegram foi interrompida."));
      });

      response.on("error", (error) => {
        reject(error);
      });

      response.on("end", () => {
        let data;

        try {
          data = JSON.parse(responseBody);
        } catch (error) {
          const invalidResponseError = new Error(
            "O Telegram retornou uma resposta que não está no formato JSON.",
          );

          invalidResponseError.code = response.statusCode;

          reject(invalidResponseError);
          return;
        }

        if (!data || data.ok !== true) {
          reject(createTelegramError(data, method, response.statusCode));

          return;
        }

        resolve(data.result);
      });
    });

    request.setTimeout(TELEGRAM_REQUEST_TIMEOUT_MS, () => {
      request.destroy(
        new Error("A conexão com a API do Telegram excedeu o tempo limite."),
      );
    });

    request.on("error", (error) => {
      reject(error);
    });

    if (requestBody) {
      request.write(requestBody);
    }

    request.end();
  });
}

module.exports = {
  telegramRequest,
};
