import type { Accept } from "./accept.ts";
import type { ActionMeta } from "./meta.ts";
import type { ImplementedAction } from "./types.ts";


export type UnsupportedContentTypeMatch = {
  type: 'unsupported-content-type';
  contentTypes: string[];
};

export type ActionAcceptMatch = {
  type: 'match';
  action: ImplementedAction;
  contentType?: string;
  language?: string;
  encoding?: string;
};

export type ActionMatchResult =
  | UnsupportedContentTypeMatch
  | ActionAcceptMatch
;

/**
 * A set of actions grouped by having equal methods and equivilent paths.
 */
export class ActionSet {
  #rootIRI: string;
  #method: string;
  #urlPattern: URLPattern;
  #meta: ActionMeta[];
  #typeRe = /^([^\/]+)\/\*$/;

  constructor(
    rootIRI: string,
    method: string,
    path: string,
    meta: ActionMeta[],
  ) {
    this.#rootIRI = rootIRI;
    this.#method = method;
    this.#meta = meta;

    this.#urlPattern = new URLPattern({
      baseURL: rootIRI,
      pathname: path,
    });
  }

  matches(method: string, path: string, accept: Accept): null | ActionMatchResult {
    if (method !== this.#method) {
      return null;
    } else if (!this.#urlPattern.test(path, this.#rootIRI)) {
      return null;
    }

    let contentTypes: string[] = [];
    const matches: ActionMeta[] = [];

    for (let index = 0; index < this.#meta.length; index++) {
      const item = this.#meta[index];

      if (item.allowsPublicAccess) {
        const action = item.action as unknown as ImplementedAction;

        contentTypes = contentTypes.concat(action.contentTypes);
      }

      // find actions where there is at least one accept match
      if (item.acceptCache.intersection(accept.acceptCache).size !== 0) {
        matches.push(item);
      }
    }

    if (matches.length === 0 && contentTypes.length !== 0) {
      return {
        type: 'unsupported-content-type',
        contentTypes,
      };
    } else if (matches.length === 0) {
      return null;
    }
      
    for (const item of accept.accept) {
      const matchesAll = item === '*/*';
      const [mimeType] = this.#typeRe.exec(item) ?? [];

      if (matchesAll) {
        const action = matches[0].action as unknown as ImplementedAction;
        const contentType = action.contentTypes[0];

        return {
          type: 'match',
          action,
          contentType,
        };
      }

      for (const meta of matches) {
        const action = meta.action as unknown as ImplementedAction;

        if (mimeType != null) {
          for (const contentType of action.contentTypes) {
            if (contentType.startsWith(mimeType)) {
              return {
                type: 'match',
                action,
                contentType,
              };
            }
          }
        } else {
          for (const contentType of action?.contentTypes) {
            if (contentType === item) {
              return {
                type: 'match',
                action,
                contentType,
              };
            }
          }
        }
      }
    }

    return null;
  }
}

