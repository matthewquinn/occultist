import test from "node:test";
import { Registry } from "./registry.ts";
import { createServer } from "node:http";

const registry = new Registry({
  rootIRI: "https://example.com",
});

registry.http.get("get-index", "/")
  .public()
  .handle("text/plain", (ctx) => {
    ctx.response.body = `Hello, world!`;
  });

registry.finalize();


test("It responds to request objects", async () => {
  console.log(registry.describeRoutes());

  const res = await registry.handleRequest(
    new Request("https://example.com"),
  );

  console.log("REQUEST RESPONSE", await res.text());
});

test("It responds to node incoming messages", async () => {
  try {
    return new Promise((resolve, reject) => {
      const server = createServer();

      server.on("request", async (req, res) => {
        await registry.handleRequest(req, res);
      });

      server.on("error", (err) => {
        console.log("ERROR", err);
        reject(err);
      });

      server.listen(0, "127.0.0.1", async () => {
        const { port, address } = server.address();
        const res = await fetch(`http://${address}:${port}`);

        console.log("INCOMING MESSAGE RESPONSE", await res.text());
      });
    });
  } catch (err) {
    console.error(err);
  }
});
