# Occultist

**Occultist** is an under-development, Koa-inspired backend web framework for Node or Deno,
adding structure to less-supported HTTP features.


## Features

### Auth middleware
All endpoints require that they are marked public or private simplifying future
auditing processes. When marked public they and can optionally have auth middleware
provided to identify the requester. Private endpoints require a auth middleware is
provided. 

### Request url and body input processing
Request bodies, route parameters and query string values can be fully described to
Occultist allowing it to unpack multipart/form-data, application/json requests 
producing a single typescript typed `ctx.payload` object with all inputs merged together.
Failed requests automatically support responding with
[application/problem+json](https://www.rfc-editor.org/rfc/rfc9457.html) responses.

### Content negotiation
Endpoints can have multiple handlers defined responding with different content
types. Occultist automatically routes the request to the correct handler based
off the request's accept header, or the first handler if no accept handler is set.

### Caching middleware
Use caching providers to store representations using the provided auth information
request's URL's parameters and resulting content type provided by the other special
case middlewares.

### Advanced features
Occultist is being built to complement the also under-development frontend framework 
[Octiron](https://github.com/occultist-dev/octiron) which is built to consume JSON-ld
APIs and build complex forms using actions in the [schema.org/Action](https://schema.org/Action)
style. This relationship will be better explained as the two frameworks stablize.


Occultist is in flux at the moment but you can try it now. Endpoints can be created
with most url and body processing features working for application/json requests and
content negotiation works for the response's content. The auth and cache features
described here are yet to be implemented.


## Installation
```
npm install @occultist/occultist
deno add jsr:@occultist/occultist
```


## Example
```typescript
import { Registry } from '@occultist/occultist';

// TODO
const auth = new AuthProvider();
// TODO
const cache = new CacheProvider();

const registry = new Registry({
  root: 'https://example.com',
});

registry.http.get('list-cats', '/cats')
  // Endpoints are marked public and can optionally have
  // auth middleware identify the requester, or they are
  // marked private and the auth check is required.
  .public(auth.optional())
  
  // resulting representation cache keys would vary based
  // on the an auth key that is unique to the user that the above
  // middleware provides, other parameters can further vary the
  // cache and control http cache headers.
  .cache(cache.etag())

  // define handlers to respond with supported content types.
  .handle('text/html', (ctx) => {
    ctx.body = `
      <!doctype>
      <html>
        <body>
          <h1>Hello, World!</h1>
        </body>
      </html>
    `;
  })
  .handle('application/json', (ctx) => {
    ctx.body = `{
      "message": "Hello, World!",
    }`;
  });

// The same method and path combination can be re-used for endpoints
// which have different middleware requirements. The accept header
// can be used by requests to pull an alternative representation.
registry.http.get('get-cat', '/cats')
  .public()
  .handle('application/xml', (ctx) => { ... })

registry.http.post('create-cat', '/cats')
  .private(auth.hasPermission('create-cats'))
  // With a body payload defined any requests with
  // application/json or multipart/form-data bodies
  // are automatically pre-processed into the `ctx.payload`.
  .define({
    spec: {
      name: {
        dataType: 'string',
        minValueLength: 2,
        valueRequired: true,
      },
      hasStripes: {
        dataType: 'boolean',
        valueRequired: true,
      },
      image: {
        // you would want to use form-data for a large file upload
        // but data uris can be sent via json
        dataType: 'blob',
      },
    },
  })
  .handle('text/html', async (ctx) => {
    const cat = await storage.createCat({
      name: ctx.payload.name,
      hasStripes: ctx.payload.hasStripes,
      image: ctx.payload.image,
    });
    ctx.status = 303;
    ctx.headers.set('Location', `https://example.com/cats/${cat.id}`);
  });

// required before requests are handled
registry.finalize();

const server = createServer();

// for Node, Deno and probably Bun.
server.on('request', (req, res) => registry.handleRequest(req, res));
server.listen(3000);
```

## Advanced features
