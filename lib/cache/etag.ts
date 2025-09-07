
const etagRe = /^"(.+)"$/;

export class ConditionalRequestRules {

  #req: Request;
  
  constructor(
    req: Request,
  ) {
    this.#req = req;
  }

  public ifMatches(
    etag: string,
  ): boolean {
    let ifMatch = this.#req.headers
      .get('if-match')?.split?.(',');

    if (ifMatch == null || ifMatch.length === 0) {
      return false;
    }

    if (ifMatch[0] === '*') {
      return etag != null;
    }

    for (const etag of ifMatch) {
      const value = etagRe.exec(etag);

      if (value?.[0] === etag) {
        return true;
      }
    }

    return false;
  }

  public ifNoneMatch(
    etag: string,
  ): boolean {
    let ifMatch = this.#req.headers
      .get('if-none-match')?.split?.(',');

    if (ifMatch == null || ifMatch.length === 0) {
      return false;
    }

    if (ifMatch[0] === '*') {
      return etag != null;
    }

    for (const etag of ifMatch) {
      const value = etagRe.exec(etag);

      if (value?.[0] === etag) {
        return false;
      }
    }

    return false;
  }

  public ifModifiedSince(): never {
    throw new Error('Not implemented');
  }
  
  public ifUnmodifiedSince(): never {
    throw new Error('Not implemented');
  }

  public ifRange(): never {
    throw new Error('Not implemented');
  }

}
