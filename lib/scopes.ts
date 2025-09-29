import { ActionAuth } from "./actions/actions.ts";
import { ActionMeta } from "./actions/meta.ts";
import type { Handler, ImplementedAction } from "./actions/types.ts";
import type { HTTPWriter } from "./actions/writer.ts";
import { type Callable, HTTP, type Registry } from './registry.ts';


export class Scope implements Callable {
  #path: string;
  #registry: Registry;
  #writer: HTTPWriter;
  #http: HTTP;
  #children: Array<ActionMeta> = [];
  
  constructor(
    path: string,
    registry: Registry,
    writer: HTTPWriter,
  ) {
    this.#path = path;
    this.#registry = registry;
    this.#writer = writer;
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

  private(): Scope {
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
      this.#registry.rootIRI,
      method.toUpperCase(),
      name,
      path,
      this.#registry,
      this.#writer,
      this,
    );

    this.#children.push(meta);
    
    return new ActionAuth(meta);
  }
}

