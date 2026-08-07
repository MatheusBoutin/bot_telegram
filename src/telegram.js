const https = require("node:https");

require("dotenv").config({
  quiet: true,
});

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("O token do Telegram não foi encontrado no arquivo .env.");
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

      // Sua rede precisou utilizar IPv4.
      family: 4,

      headers: {},
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

      response.on("end", () => {
        let data;

        try {
          data = JSON.parse(responseBody);
        } catch (error) {
          reject(
            new Error(
              "O Telegram retornou uma resposta que não está no formato JSON.",
            ),
          );

          return;
        }

        if (!data.ok) {
          let errorMessage = `Erro ao executar o método ${method}.`;

          if (data.description) {
            errorMessage = data.description;
          }

          reject(new Error(errorMessage));

          return;
        }

        resolve(data.result);
      });
    });

    request.setTimeout(15000, () => {
      request.destroy(
        new Error("A conexão com a API do Telegram excedeu 15 segundos."),
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
