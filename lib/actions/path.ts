import { makeURLPattern } from "../utils/makeURLPattern.ts";

const paramsRe = /((?<s>[^\{\}]+)|({(?<t>[\?\#])?(?<v>[^}]+)}))/g

/**
 * Util class for handling paths defined using URI templates.
 * https://datatracker.ietf.org/doc/html/rfc6570.
 *
 * URI Templates are used instead of URLPattern format to conform to
 * JSON-ld https://schema.org/entryPoint needs. It is possible to add
 * regex syntax which would end up in the generated URLPattern making
 * it in conflict with the URITemplate. To be fixed...
 */
export class Path {
  #rootIRI: string;
  #pathTemplate: string;
  #pattern: URLPattern;
  #paramKeys: Set<string> = new Set();
  #queryKeys: Set<string> = new Set();
  #fragmentKeys: Set<string> = new Set();

  constructor(pathTemplate: string, rootIRI: string) {
    this.#pathTemplate = pathTemplate;
    this.#rootIRI = rootIRI;

    let pattern: string = '';
    
    // assign values to key location sets for quick querying
    let match: RegExpExecArray | null;
    let foundQueryOrFragment = false;
    let index = 0;
    while ((match = paramsRe.exec(this.#pathTemplate))) {
      const segment = match.groups?.s;
      const type = match.groups?.t;
      const value = match.groups?.v;

      if (type != null) {
        foundQueryOrFragment = true;
      }

      if (!foundQueryOrFragment && segment != null && type == null) {
        pattern += segment;
      }
      
      if (value == null) {
        continue;
      }

      if (!foundQueryOrFragment && value != null) {
        index++;
        pattern += `:value${index}`;
      }

      const set = type == null
        ? this.#paramKeys
        : type === '?'
        ? this.#queryKeys
        : this.#fragmentKeys;

      const keys = value.split(',');
      
      for (let index = 0; index < keys.length; index++) {
        set.add(keys[index]);
      }
    }

    this.#pattern = makeURLPattern(pattern, this.#rootIRI);
  }

  static normalizePath(path: string): string {
    const paramsRe = /((?<s>[^\{\}]+)|({(?<t>[\?\#])?(?<v>[^}]+)}))/g
    let pattern: string = '';
    
    // assign values to key location sets for quick querying
    let match: RegExpExecArray | null;
    let foundQueryOrFragment = false;
    let index = 0;

    while ((match = paramsRe.exec(path))) {
      const segment = match.groups?.s;
      const type = match.groups?.t;
      const value = match.groups?.v;

      if (type != null) {
        foundQueryOrFragment = true;
      }

      if (!foundQueryOrFragment && segment != null && type == null) {
        pattern += segment;
      }
      
      if (value == null) {
        continue;
      }

      if (!foundQueryOrFragment && value != null) {
        index++;
        pattern += `:value${index}`;
      }
    }

    return pattern;
  }

  get pattern() {
    return this.#pattern;
  }

  /**
   * Returns the location of the given key if it is present in
   * the path.
   */
  locationOf(key: string): 'params' | 'query' | 'fragment' | null {
    if (this.#paramKeys.has(key)) {
      return 'params';
    } else if (this.#queryKeys.has(key)) {
      return 'query';
    } else if (this.#fragmentKeys.has(key)) {
      return 'fragment';
    }

    return null;
  }
}
