import { ActionMeta, ActionAuth, type ImplementedAction, type Handler } from "../actions/actions.ts";
import { type Callable, HTTP, type Registry } from '../registry/registry.ts';


export class Scope implements Callable {

  #path: string;
  #registry: Registry;
  #http: HTTP;
  #children: Array<ActionMeta> = [];
  
  constructor(
    path: string,
    registry: Registry,
  ) {
    this.#path = path;
    this.#registry = registry;
    this.#http = new HTTP(this);
  }

  get path(): string {
    return this.#path;
  }

  get registry(): Registry {
    return this.#registry;
  }

  get http(): HTTP {
    return this.#http;
  }

  get actions(): Array<ImplementedAction> {
    return this.#children
      .filter((meta) => {
        if (meta.action == null) {
          console.warn(`Action ${meta.method}: ${meta.path} not fully implemented before processing`);
        }

        return meta.action != null;
      })
      .map((meta) => meta.action) as Array<ImplementedAction>;
  }

  get handlers(): Handler[] {
    return this.actions.flatMap((action) => action.handlers);
  }

  public(): Scope {
    return this;
  }

  auth(): Scope {
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
      this.#registry,
      this,
    );

    this.#children.push(meta);
    
    return new ActionAuth(meta);
  }
}

