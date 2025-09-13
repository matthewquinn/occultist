import { ActionAuth, ActionMeta, type Handler, type ImplementedAction } from "../actions/actions.ts";
import { Scope } from '../scopes/scopes.ts';


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

export type RegistryArgs = {
  rootIRI: string;
};

export class Registry implements Callable {

  #path: string;
  #rootIRI: string;
  #http: HTTP;
  #scopes: Scope[] = [];
  #children: ActionMeta[] = [];
  #extensions: Map<string, string> = new Map();

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

  extensions(extensions: ExtensionMap) {
    this.#extensions = new Map(
      Object.entries(extensions),
    );

    return this;
  }

  /**
   * Creates any HTTP method.
   *
   * @param method The HTTP method.
   * @param name   Name for the action being produced.
   * @param path   Path the action responds to.
   */
  method(method: string, name: string, path: string): ActionAuth {
    const meta = new ActionMeta(
      method,
      name,
      path,
      this,
    );

    this.#children.push(meta);
    
    return new ActionAuth(meta);
  }

}

