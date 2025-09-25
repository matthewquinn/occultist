import { ServerResponse } from 'node:http';
import type { HintLink, HintArgs } from './types.ts';


export interface HTTPWriter {
  writeEarlyHints(args: HintArgs): void;
  writeHead(status: number, headers?: Headers): void;
  writeBody(body: ReadableStream): void;
};

export class FetchResponseWriter implements HTTPWriter {

  #res?: ServerResponse;
  #hints?: {
    link: string | string[];
  };
  #status?: number;
  #statusText?: string;
  #headers: Headers = new Headers();
  #body?: BodyInit;

  constructor(
    res?: ServerResponse,
  ) {
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
    const res = this.#res;
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

    if (res == null || res.writeEarlyHints == null) {
      this.#hints = hints;

      return;
    }

    return new Promise<void>((resolve, reject) => {
      try {
        res.writeEarlyHints(hints, resolve)
      } catch (err) {
        reject(err);
      }
    });
  }

  writeHead(status: number, headers?: Headers) {
    const res = this.#res;

    this.#status = status;
   
    if (headers != null) {
      this.#setHeaders(headers);
    }

    if (res instanceof ServerResponse && this.#hints != null) {
      res.writeHead(status, this.#hints);
    } else if (res instanceof ServerResponse) {
      res.writeHead(status);
    }
  }

  writeBody(body: ReadableStream): void {
    if (this.#res instanceof ServerResponse) {
      this.#res.write(body);
    }
  }

  toResponse(): Response | null {
    if (this.#res instanceof ServerResponse) {
      return null;
    }

    return new Response(this.#body, {
      status: this.#status,
      statusText: this.#statusText,
      headers: this.#headers,
    });
  }

  #setHeaders(headers: Headers): void {
    for (const [header, value] of headers.entries()) {
      if (Array.isArray(value)) {
        for (const item of value) {
          this.#headers.append(header, item);
        }
      } else {
        this.#headers.append(header, value);
      }
    }
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
