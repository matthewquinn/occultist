
/**
 * Future proofing for cross platform differences
 * where node:http might not be accessable.
 */
type IncomingMessageHeaderObject = {
  headers: {
    'accept'?: string;
    'accept-language'?: string;
    'accept-encoding'?: string;
  };
};


/**
 * Creates a content type cache usually from the set of content type
 * options supported by an action or action set.
 */
export class ContentTypeCache {
  default: string;
  set: Set<string>;
  map: Map<string, string> = new Map();
  contentTypes: string[];

  constructor(contentTypes: string[]) {
    this.default = contentTypes[0];
    this.contentTypes = contentTypes;
    this.set = new Set(contentTypes);

    this.set.add('*/*');
    this.map.set('*/*', contentTypes[0]);

    for (let index = 0; index < contentTypes.length; index++) {
      const contentType = contentTypes[index];
      const type = contentType.replace(/[^\/]*$/, '*');
      
      this.map.set(contentType, contentType);

      if (!this.map.has(type)) {
        this.set.add(type);
        this.map.set(type, contentType);
      }
    }
  }
}

/**
 * This accept object is created from a request before any content negotiation
 * begins allowing all subsequent checks to re-use the same caches header values.
 *
 * @todo Harden against DDOS attacks.
 * @todo Adds support for all accept headers.
 *
 * @param accept - The value of the request's accept header.
 * @param acceptLanguage - The value of the request's accept-language header.
 * @param acceptEncoding - The value of the request's accept-encoding header.
 */
export class Accept {
  #acceptRe = /(?<ct>[^,;\s]+)(;\s?q=(?<q>(\d(\.\d+)|(.\d))))?/g;
  #accept: string[] = [];
  #acceptCache: Set<string> = new Set();
  #acceptLanguage: string[] = [];
  #acceptLanguageCache: Set<string> = new Set();
  #acceptEncoding: string[] = [];
  #acceptEncodingCache: Set<string> = new Set();

  constructor(
    accept: string | null,
    acceptLanguage: string | null,
    acceptEncoding: string | null,
  ) {
    [this.#accept, this.#acceptCache] = this.#process(accept);
    [this.#acceptLanguage, this.#acceptLanguageCache] = this.#process(acceptLanguage);
    [this.#acceptEncoding, this.#acceptEncodingCache] = this.#process(acceptEncoding);
  }

  /**
   * Creates an accept instance from a request or response instance
   */
  static from(req: Request | IncomingMessageHeaderObject): Accept {
    let accept: string | null;
    let acceptLanguage: string | null;
    let acceptEncoding: string | null;

    if (req instanceof Request) {
      accept = req.headers.get('Accept');
      acceptLanguage = req.headers.get('Accept-Language');
      acceptEncoding = req.headers.get('Accept-Encoding');
    } else {
      accept = req.headers['accept'] ?? null;
      acceptLanguage = req.headers['accept-language'] ?? null;
      acceptEncoding = req.headers['accept-encoding'] ?? null;
    }
    
    return new Accept(
      accept,
      acceptLanguage,
      acceptEncoding,
    );
  }

  /**
   * Negotiates against the cached set of content type options.
   *
   * @param contentType Content type cache built for an action.
   */
  negotiate(contentType: ContentTypeCache): null | string {
    if (this.#accept.length === 0) {
      return contentType.default;
    }

    // TODO: check might be over-optimizing.
    const intersection = this.#acceptCache.intersection(contentType.set);
    
    if (intersection.size === 0) {
      return null;
    }
    
    for (let index = 0; index < this.#accept.length; index++) {
      const match = contentType.map.get(this.#accept[index]);

      if (match != null) {
        return match;
      }
    }

    return null;
  }

  #process(header: string | null): [string[], Set<string>] {
    if (header == null) {
      return [[], new Set('*/*')];
    }

    let match: RegExpExecArray | null;

    const items: Array<{ ct: string, q: number }> = [];
    const cache = new Set<string>();

    while ((match = this.#acceptRe.exec(header))) {
      const ct = match.groups?.ct as string;
      const q = Number(match.groups?.q ?? 1);

      cache.add(ct);
      items.push({ ct, q });
    }
    
    return [
      items.toSorted((a, b) => b.q - a.q)
        .map(({ ct }) => ct),
      cache,
    ];
  }
}

