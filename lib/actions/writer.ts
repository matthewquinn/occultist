import type { ServerResponse } from 'node:http';
import type { HintLink, HintArgs } from './types.ts';


export class Writer {

  #res: ServerResponse;
  #hints?: {
    link: string | string[];
  };

  constructor(res: ServerResponse) {
    this.#res = res;
  }

  /**
   * Writes early hints to the request.
   *
   * Deno currently does not support early hints and will
   * add link tags to the HTTP header of the main response
   * instead.
   */
  writeEarlyHints(args: HintArgs) {
    let link: string | string[];

    if (Array.isArray(args.link)) {
      link = args.link.map(this.#formatEarlyHint);
    } else if (args.link != null) {
      link = this.#formatEarlyHint(args.link);
    } else {
      return;
    }

    const hints: {
      link: string | string[];
    } = { link };

    if (this.#res.writeEarlyHints == null) {
      this.#hints = hints;

      return;
    }

    return new Promise<void>((resolve, reject) => {
      try {
        this.#res.writeEarlyHints(hints, resolve)
      } catch (err) {
        reject(err);
      }
    });
  }

  writeHead(statusCode: number) {
      console.log('HINTS', this.#hints);
    if (this.#hints != null) {
      this.#res.writeHead(statusCode, this.#hints);
    } else {
      this.#res.writeHead(statusCode);
    }
  }

  writeBody(body: ReadableStream) {
    this.#res.end(body)
  }

  #formatEarlyHint(hint: HintLink): string {
    let link: string = `</${hint.href}>`;

    if (hint.preload) {
      link += `; rel=preload`;
    }

    if (Array.isArray(hint.rel)) {
      link += '; ' + hint.rel.map((rel) => `rel=${rel}`)
        .join('; ') + '';
    } else if (hint.rel != null) {
      link += `; rel=${hint.rel}`;
    }
      
    if (hint.as != null) {
      link += `; as=${hint.as}`;
    }

    if (hint.fetchPriority != null) {
      link += `; fetchpriority=${hint.fetchPriority}`;
    }

    if (hint.crossOrigin != null) {
      link += `; crossorigin=${hint.crossOrigin}`;
    }

    return link;
  }

}
