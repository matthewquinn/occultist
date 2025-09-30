import assert from 'node:assert/strict';
import test from "node:test";
import { Registry } from "./registry.ts";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

const registry = new Registry({
  rootIRI: "https://example.com",
});

registry.http.get("get-index", "/")
  .public()
  .hint({
    link: {
      href: 'http://example.com/messages.json',
      type: 'application/json',
      preload: true,
    },
  })
  .handle("text/plain", (ctx) => {
    ctx.body = `Hello, world!`;
  })
  .handle('application/json', (ctx) => {
    ctx.body = JSON.stringify({
      foo: 'bar',
    });
  });

registry.http.post('post-things', '/posty/post')
  .public()
  .handle('text/html', async (ctx) => {
    ctx.body = await Promise.resolve(`
      <!doctype html>
      <html>
        <body>Got it</body>
      </html>
    `);
  });

registry.finalize();


test("It responds to request objects", async () => {
  const res = await registry.handleRequest(
    new Request("https://example.com"),
  );

  assert(await res.text() === 'Hello, world!');
});

test("It responds to node incoming messages", async () => {
  const res = await new Promise<Response>((resolve, reject) => {
    const server = createServer();

    server.on("request", async (req, res) => {
      await registry.handleRequest(req, res);
    });

    server.on("error", (err) => {
      reject(err);
    });

    server.listen(0, "127.0.0.1", async () => {
      const { port, address } = server.address() as AddressInfo;
      const res = await fetch(`http://${address}:${port}`);

      resolve(res);
    });
  });

  assert(await res.text() === 'Hello, world!');
});

test("It uses the correct handler for the accepted content type", async () => {
  const res = await registry.handleRequest(
    new Request("https://example.com", {
      headers: { 'Accept': 'application/*' }
    }),
  );

  assert((await res.json()).foo === 'bar');
});

test('It responds to other HTTP methods', async () => {
  const res = await registry.handleRequest(
    new Request('https://example.com/posty/post', {
      method: 'POST',
      headers: { 'Accept': 'text/html' },
    })
  );

  assert((await res.text()).includes('<body>Got it</body>'))
});
