import { createServer } from 'node:http';
import { Writer } from './writer.ts';
import { assertEquals } from 'jsr:@std/assert';


Deno.test('Writer writes hints', {
  permissions: {
    net: ['127.0.0.1'],
  },
}, () => {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.on('request', async (req, res) => {
      const writer = new Writer(res);
      await writer.writeEarlyHints({
        link: [
          {
            href: 'https://example.com/main.css',
            as: 'stylesheet',
            preload: true,
            fetchPriority: 'high',
          },
          {
            href: 'https://example.com/main.js',
            as: 'script',
            preload: true,
            fetchPriority: 'low',
          }
        ],
      });

      writer.writeHead(200);

      res.end();
    });

    server.on('error', (err) => {
      reject(err);
    });
  
    server.listen(0, '127.0.0.1', async () => {
      const { port, address } = server.address();
  
      const res = await fetch(`http://${address}:${port}`);
      await res.text();

      assertEquals(
        res.headers.get('link'),
        `</https://example.com/main.css>; rel=preload; as=stylesheet; fetchpriority=high, `
        + `</https://example.com/main.js>; rel=preload; as=script; fetchpriority=low`,
      );

      server.close();

      resolve();
    });
  });
});
