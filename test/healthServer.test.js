const assert = require("node:assert/strict");
const http = require("node:http");
const { after, before, test } = require("node:test");

const {
  startHealthServer,
  closeHealthServer,
} = require("../src/http/healthServer");

let server;
let baseUrl;

function request(path) {
  return new Promise((resolve, reject) => {
    http
      .get(`${baseUrl}${path}`, (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => resolve({ response, body }));
      })
      .on("error", reject);
  });
}

before(async () => {
  server = await startHealthServer({ port: 0 });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await closeHealthServer(server);
  assert.equal(server.listening, false);
});

test("GET /health retorna status e JSON de saúde", async () => {
  const { response, body } = await request("/health");
  const data = JSON.parse(body);

  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"], /^application\/json/);
  assert.equal(data.status, "ok");
  assert.equal(data.service, "bot-da-min-telegram");
  assert.equal(typeof data.uptimeSeconds, "number");
  assert.ok(!Number.isNaN(Date.parse(data.timestamp)));
});

test("rota desconhecida retorna 404", async () => {
  const { response } = await request("/desconhecida");
  assert.equal(response.statusCode, 404);
});

test("servidor pode ser encerrado de forma controlada", async () => {
  const temporaryServer = await startHealthServer({ port: 0 });
  await closeHealthServer(temporaryServer);
  assert.equal(temporaryServer.listening, false);
});
