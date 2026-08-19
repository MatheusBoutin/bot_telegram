const https = require("node:https");
const { TELEGRAM_REQUEST_TIMEOUT_MS } = require("./config/pollingConfig");

require("dotenv").config({ quiet: true });

function getTelegramBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("O token do Telegram não foi encontrado no ambiente.");
  return token;
}

function createTelegramError(data, method, statusCode) {
  const error = new Error(data?.description || `Erro ao executar o método ${method}.`);
  error.code = data?.error_code || statusCode;
  const retryAfterSeconds = Number(data?.parameters?.retry_after);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) error.retryAfterMs = retryAfterSeconds * 1000;
  return error;
}

function parseTelegramResponse(body, method, statusCode) {
  let data;
  try { data = JSON.parse(body); } catch {
    throw Object.assign(new Error("O Telegram retornou uma resposta que não está no formato JSON."), { code: statusCode });
  }
  if (!data || data.ok !== true) throw createTelegramError(data, method, statusCode);
  return data.result;
}

function collectTelegramResponse(response, method, resolve, reject) {
  let body = "";
  response.setEncoding("utf8");
  response.on("data", (chunk) => { body += chunk; });
  response.on("aborted", () => reject(new Error("A conexão com o Telegram foi interrompida.")));
  response.on("error", reject);
  response.on("end", () => {
    try { resolve(parseTelegramResponse(body, method, response.statusCode)); } catch (error) { reject(error); }
  });
}

function createApiRequest(method, headers, onResponse) {
  const token = getTelegramBotToken();
  return https.request({
    hostname: "api.telegram.org", port: 443, path: `/bot${token}/${method}`,
    method: headers ? "POST" : "GET", family: 4,
    headers: { Accept: "application/json", ...headers },
  }, onResponse);
}

function setRequestSafety(request) {
  request.setTimeout(TELEGRAM_REQUEST_TIMEOUT_MS, () => {
    request.destroy(new Error("A conexão com a API do Telegram excedeu o tempo limite."));
  });
}

function telegramRequest(method, body = null) {
  return new Promise((resolve, reject) => {
    const requestBody = body ? JSON.stringify(body) : null;
    const headers = requestBody ? {
      "Content-Type": "application/json", "Content-Length": Buffer.byteLength(requestBody),
    } : null;
    const request = createApiRequest(method, headers, (response) => collectTelegramResponse(response, method, resolve, reject));
    setRequestSafety(request);
    request.on("error", reject);
    request.end(requestBody || undefined);
  });
}

function buildMultipartBody(fields, files, boundary) {
  const chunks = [];
  const append = (value) => chunks.push(Buffer.from(value, "utf8"));
  for (const [name, value] of Object.entries(fields || {})) {
    append(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n`);
    append(`${typeof value === "string" ? value : JSON.stringify(value)}\r\n`);
  }
  for (const file of files || []) {
    append(`--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`);
    chunks.push(file.data);
    append("\r\n");
  }
  append(`--${boundary}--\r\n`);
  return Buffer.concat(chunks);
}

function telegramMultipartRequest(method, { fields = {}, files = [] }) {
  const boundary = `telegram-form-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  const body = buildMultipartBody(fields, files, boundary);
  return new Promise((resolve, reject) => {
    const request = createApiRequest(method, {
      "Content-Type": `multipart/form-data; boundary=${boundary}`, "Content-Length": body.length,
    }, (response) => collectTelegramResponse(response, method, resolve, reject));
    setRequestSafety(request);
    request.on("error", reject);
    request.end(body);
  });
}

function downloadTelegramFile(filePath, maxBytes) {
  if (typeof filePath !== "string" || !filePath || filePath.includes("..") || /^[a-z]+:/i.test(filePath)) {
    return Promise.reject(new Error("O Telegram retornou um caminho de arquivo inválido."));
  }
  const token = getTelegramBotToken();
  const safePath = filePath.split("/").map(encodeURIComponent).join("/");
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: "api.telegram.org", port: 443, path: `/file/bot${token}/${safePath}`,
      method: "GET", family: 4, headers: { Accept: "image/jpeg" },
    }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(Object.assign(new Error("Não foi possível baixar o arquivo do Telegram."), { code: response.statusCode }));
        return;
      }
      const chunks = [];
      let size = 0;
      let tooLarge = false;
      response.on("data", (chunk) => {
        size += chunk.length;
        if (size > maxBytes) {
          tooLarge = true;
          response.destroy(Object.assign(new Error("A imagem excede o tamanho permitido."), { code: "FILE_TOO_LARGE" }));
        }
        else chunks.push(chunk);
      });
      response.on("aborted", () => reject(new Error("O download do Telegram foi interrompido.")));
      response.on("error", reject);
      response.on("end", () => {
        if (!tooLarge) resolve(Buffer.concat(chunks, size));
      });
    });
    setRequestSafety(request);
    request.on("error", reject);
    request.end();
  });
}

function redactTelegramSecrets(value) {
  let text = value?.stack || value?.message || String(value);
  const secrets = [
    process.env.TELEGRAM_BOT_TOKEN,
    process.env.DATABASE_URL,
    process.env.DB_PASSWORD,
  ].filter(Boolean);

  for (const secret of secrets) {
    text = text.split(secret).join("[REDACTED]");
  }

  return text
    .replace(/api\.telegram\.org\/(?:file\/)?bot[^/\s]+/gi, "api.telegram.org/[REDACTED]")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_DATABASE_URL]");
}

module.exports = { telegramRequest, telegramMultipartRequest, downloadTelegramFile, buildMultipartBody, redactTelegramSecrets };
