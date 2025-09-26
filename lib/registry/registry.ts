import { Accept } from "../accept.ts";
import { ActionAuth } from "../actions/actions.ts";
import { type ActionMatchResult, ActionSet } from "../actions/actionSets.ts";
import { ActionMeta } from "../actions/meta.ts";
import { Path } from "../actions/path.ts";
import type { Handler, ImplementedAction } from "../actions/types.ts";
import { FetchResponseWriter } from "../actions/writer.ts";
import { Scope } from '../scopes/scopes.ts';
import type { IncomingMessage, ServerResponse } from "node:http";


export type ExtensionMap = Record<string, string>;

export interface Callable {
  method(method: string, name: string, path: string): ActionAuth;
}

export class HTTP {

  #callable: Callable;

  constructor(callable: Callable) {
    this.#callable = callable;
  }

  trace(name: string, path: string): ActionAuth {
    return this.#callable.method('trace', name, path);
  }

  options(name: string, path: string): ActionAuth {
    return this.#callable.method('options', name, path);
  }

  head(name: string, path: string): ActionAuth {
    return this.#callable.method('head', name, path);
  }

  get(name: string, path: string): ActionAuth {
    return this.#callable.method('get', name, path);
  }

  put(name: string, path: string): ActionAuth {
    return this.#callable.method('put', name, path);
  }

  patch(name: string, path: string): ActionAuth {
    return this.#callable.method('patch', name, path);
  }

  post(name: string, path: string): ActionAuth {
    return this.#callable.method('post', name, path);
  }

  delete(name: string, path: string): ActionAuth {
    return this.#callable.method('delete', name, path);
  }

}


export class IndexEntry {
  #actionSets: ActionSet[];

  constructor(actionSets: ActionSet[]) {
    this.#actionSets = actionSets;
  }

  match(method: string, path: string, accept: Accept): null | ActionMatchResult {
    for (let index = 0; index < this.#actionSets.length; index++) {
      const actionSet = this.#actionSets[index];
      const match = actionSet.matches(method, path, accept);

      if (match != null) {
        return match;
      }
    }

    return null;
  }
}

export type RegistryArgs = {
  rootIRI: string;
};

export class Registry implements Callable {

  #path: string;
  #rootIRI: string;
  #http: HTTP;
  #scopes: Scope[] = [];
  #children: ActionMeta[] = [];
  //#extensions: Map<string, string> = new Map();
  #index?: IndexEntry;
  #writer = new FetchResponseWriter();

  constructor(args: RegistryArgs) {
    const url = new URL(args.rootIRI);

    this.#rootIRI = args.rootIRI;
    this.#path = url.pathname
    this.#http = new HTTP(this);
  }

  scope(path: string) {
    const scope = new Scope(
      path,
      this,
      this.#writer,
    );

    this.#scopes.push(scope);
    
    return scope;
  }
  
  get rootIRI(): string {
    return this.#rootIRI;
  }

  get path(): string {
    return this.#path;
  }

  get http(): HTTP {
    return this.#http;
  }

  get actions(): Array<ImplementedAction> {
    const implemented = this.#children
      .filter((meta) => {
        if (meta.action == null) {
          console.warn(`Action ${meta.method}: ${meta.path} not fully implemented before processing`);
        }

        return meta.action != null;
      })
      .map((meta) => meta.action) as Array<ImplementedAction>;

    return implemented.concat(
      this.#scopes.flatMap((scope) => scope.actions)
    );
  }

  get handlers(): Handler[] {
    return this.actions.flatMap((action) => action.handlers);
  }

  get(actionName: string): ImplementedAction | undefined {
    return this.actions.find((action) => action.name === actionName);
  }

  //extensions(extensions: ExtensionMap) {
  //  this.#extensions = new Map(
  //    Object.entries(extensions),
  //  );

  //  return this;
  //}

  /**
   * Creates any HTTP method.
   *
   * @param method The HTTP method.
   * @param name   Name for the action being produced.
   * @param path   Path the action responds to.
   */
  method(method: string, name: string, path: string): ActionAuth {
    const meta = new ActionMeta(
      this.#rootIRI,
      method,
      name,
      path,
      this,
      this.#writer,
    );

    this.#children.push(meta);
    
    return new ActionAuth(meta);
  }

  finalize() {
    const actionSets: ActionSet[] = [];
    const groupedMeta = new Map<string, Map<string, ActionMeta[]>>();

    for (let index = 0; index < this.#children.length; index++) {
      const meta = this.#children[index];
      const method = meta.method;
      const normalizePath = Path.normalizePath(meta.pathTemplate);

      meta.finalize();

      const group = groupedMeta.get(normalizePath);
      const methodSet = group?.get(method);

      if (methodSet != null) {
        methodSet.push(meta);
      } else if (group != null) {
        group.set(method, [meta]);
      } else {
        groupedMeta.set(normalizePath, new Map([[method, [meta]]]));
      }
    }

    for (const [normalizePath, methodSet] of groupedMeta.entries()) {
      for (const [method, meta] of methodSet.entries()) {
        const actionSet = new ActionSet(
          this.#rootIRI,
          method,
          normalizePath,
          meta,
        );

        actionSets.push(actionSet);
      }
    }

    this.#index = new IndexEntry(actionSets);
  }

  handleRequest(req: Request): Promise<Response>;
  handleRequest(req: IncomingMessage, res: ServerResponse): Promise<ServerResponse>;

  handleRequest(
    req: Request | IncomingMessage,
    res?: ServerResponse,
  ): Promise<Response | ServerResponse> {
    const accept = Accept.from(req);
    const match = this.#index?.match(
      req.method ?? 'GET',
      req.url ?? '/',
      accept,
    );

    if (match?.type === 'match') {
      return match.action.handleRequest(req as IncomingMessage, res as ServerResponse);
    }

    throw new Error('Not implemented');
  }
  
}
