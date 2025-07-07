import { Buffer } from "node:buffer";
import { ContentType } from "../action.ts";
import type { Context } from "../types.ts";

export function getResponseBody(ctx: Context): BodyInit | null | undefined {
  if (ctx.req.method === 'HEAD') {
    return null;
  }

  if (ctx.bodySerialized) {
    return ctx.body as BodyInit;
  }

  if (ctx.body instanceof ReadableStream || Buffer.isBuffer(ctx.body) || ctx.body instanceof Blob) {
    return ctx.body;
  } else if (ctx.contentType === ContentType.TextHTML && typeof ctx.body === 'string') {
    return Buffer.from(ctx.body, 'utf-8');
  } else if (ctx.body != null) {
    return Buffer.from(JSON.stringify(ctx.body), 'utf-8');
  }

  return null;
}


export function makeResponse(ctx: Context) {
  if (ctx.req.method === 'HEAD') {
    return new Response(null, {
      status: ctx.status,
      headers: ctx.headers,
    });
  }

  const body = getResponseBody(ctx);

  return new Response(body, {
    status: ctx.status,
    headers: ctx.headers,
  });
}
