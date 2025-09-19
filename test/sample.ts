
import { createReadStream } from 'node:fs';
import { Registry } from '../lib/registry/registry.ts';
import { Cache } from '../lib/cache/cache.ts';

const cache = new Cache();

const registry = new Registry({
  rootIRI: 'https://example.com',
});

const publicScope = registry.scope('/actions')
  .public();

const privateScope = registry.scope('/actions')
  .auth();

const loginStyles = registry.http.get('login-styles', '/public/stylesheet/{hash}')
  .public()
  .compress()
  .cache(cache.etag({ strong: true }))
  .handle('text/css', (ctx) => {
    ctx.response.body = createReadStream('/path/to/file.css');
  });

publicScope.http.get('login-page', '/public/login')
  .public()
  .hint(() => ({
    link: { rel: 'stylesheet', href: loginStyles.url(), preload: true },
  }))
  .cache(cache.store())
  .handle('text/html', (ctx) => {
    ctx.response.status = 200;
    ctx.response.body = createReadStream('/path/to/file.html');
  });

publicScope.http.post('create-session', '/public/sessions')
  .public()
  .define({
    spec: {
      username: {
        type: 'string',
        minLength: 3,
      },
      password: {
        type: 'string',
        minLength: 8,
      },
    }
  })
  .handle('text/html', (ctx) => {
    ctx.response.status = 303;
    ctx.response.headers.set('Location', '/');
  })
  .handle(['application/ld+json', 'application/json'], async (ctx) => {
    
  });

privateScope.http.get('index-page', '/')
  .auth()
  .cache(cache.store())
