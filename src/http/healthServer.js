const http = require("node:http");

function resolvePort(port) {
  const parsedPort = Number(port ?? process.env.PORT ?? 3000);

  if (!Number.isInteger(parsedPort) || parsedPort < 0 || parsedPort > 65535) {
    throw new RangeError("PORT deve ser um número inteiro entre 0 e 65535.");
  }

  return parsedPort;
}

function startHealthServer({ port } = {}) {
  const server = http.createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          status: "ok",
          service: "bot-da-min-telegram",
          uptimeSeconds: Math.floor(process.uptime()),
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "not_found" }));
  });

  return new Promise((resolve, reject) => {
    const handleError = (error) => reject(error);
    server.once("error", handleError);
    server.listen(resolvePort(port), "0.0.0.0", () => {
      server.off("error", handleError);
      resolve(server);
    });
  });
}

function closeHealthServer(server) {
  if (!server?.listening) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

module.exports = { startHealthServer, closeHealthServer };
