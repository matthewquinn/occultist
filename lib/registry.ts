import { accepts } from "@std/http/negotiation";
import { STATUS_CODE } from "@std/http/status";
import { Buffer } from "node:buffer";
import { joinPaths, ContentType, PreAction } from "./action.ts";
import type { Aliases, EmptyObject, Merge, JSONObject, JSONLDContext, TypeDef } from "./jsonld.ts";
import type { ContextState, Action, Middleware, ActionHTTPMethod, NextFn, Context } from "./types.ts";
import { makeResponse } from "./utils/makeResponse.ts";
import { urlToIRI } from "./utils/urlToIRI.ts";
import { contextBuilder } from "./utils/contextBuilder.ts";

export type ActionRegistryArgs = {
  rootIRI: string;
  contextIRI: string;
  typeDefs?: Record<string, TypeDef> | TypeDef[];
  vocab?: string;
  aliases?: Aliases;
  actionPathPrefix: string;
  useFileExtensions?: boolean;
};

export type RouteArgs = {
  useFileExtensions?: boolean;
  extensions?: Record<string, string>;
};

export class ActionRegistry<const State extends ContextState = EmptyObject> {
  #rootIRI: string;
  #contextIRI: string;
  #urlPattern: URLPattern;
  #vocab?: string;
  #useFileExtensions?: boolean;
  #aliases?: Aliases;
  #typeDefs: Record<string, TypeDef> | TypeDef[] = [];
  #actions: Array<Action> = [];
  // deno-lint-ignore no-explicit-any
  #middleware: Array<Middleware<any>> = [];

  public constructor(args: ActionRegistryArgs) {
    this.#rootIRI = args.rootIRI;
    this.#contextIRI = args.contextIRI;
    this.#vocab = args.vocab;
    this.#typeDefs = args.typeDefs ?? [];
    this.#aliases = args.aliases;
    this.#useFileExtensions = args.useFileExtensions;
    this.#urlPattern = new URLPattern({
      baseURL: this.#rootIRI,
      pathname: args.actionPathPrefix,
    });
  }

  public use<MiddlewareState extends ContextState = State>(
    middleware: Middleware<MiddlewareState>,
  ): ActionRegistry<Merge<State, MiddlewareState>> {
    this.#middleware.push(middleware);

    return this as ActionRegistry<Merge<State, MiddlewareState>>;
  }

  public get contextIRI(): string {
    return this.#contextIRI;
  }

  public get context(): JSONLDContext {
    return contextBuilder({
      vocab: this.#vocab,
      aliases: this.#aliases,
      typeDefs: this.#typeDefs,
    });
  }

  public get vocab(): string | undefined {
    return this.#vocab;
  }

  public get aliases(): Aliases | undefined {
    return this.#aliases;
  }

  public get(name: string, path: string, args?: RouteArgs): PreAction<State> {
    return this.#callMethod<'get'>('get', name, path, args);
  }

  public post(name: string, path: string, args?: RouteArgs): PreAction<State> {
    return this.#callMethod<'post'>('post', name, path, args);
  }

  public put(name: string, path: string, args?: RouteArgs): PreAction<State> {
    return this.#callMethod<'put'>('put', name, path, args);
  }

  public delete(name: string, path: string, args?: RouteArgs): PreAction<State> {
    return this.#callMethod<'delete'>('delete', name, path, args);
  }

  public body(): JSONObject {
    const body: JSONObject = {
      '@id': joinPaths(this.#rootIRI, this.#urlPattern.pathname),
    };

    for (const action of this.#actions) {
      const partial = action.partial();

      if (action.type && partial) {
        body[action.type] = partial;
      }
    }

    return body;
  }

  async #handleActionRequest(ctx: Context) {
    if (this.#urlPattern.test(ctx.iri)) {
      return new Response(Buffer.from(JSON.stringify(this.body())), {
        headers: {
          'content-type': ContentType.ApplicationJSONLD,
        },
      });
    }

    for (const action of this.#actions) {
      if (action.actionIRI === ctx.iri.replace(/\/$/, '')) {
        return new Response(Buffer.from(JSON.stringify(await action.body())), {
          headers: {
            'content-type': ContentType.ApplicationJSONLD,
          },
        });
      }
    }
  }

  public async handleRequest(req: Request): Promise<Response> {
    const method = req.method as ActionHTTPMethod;
    const iri = urlToIRI(req.url, this.#rootIRI);
    const state = {};
    const ctx: Context = {
      method,
      iri,
      req,
      state,
      registry: this,
      contentType: '',
      headers: new Headers(),
      bodySerialized: false,
    };

    try {
      const url = new URL(iri);

      if (
        req.method === 'GET' &&
        url.pathname.startsWith(this.#urlPattern.pathname) &&
        accepts(req, ContentType.ApplicationJSONLD)
      ) {
        const res = await this.#handleActionRequest(ctx);

        if (res) {
          return res;
        }
      }

      for (const action of this.#actions) {
        const accept = action.accepts(ctx);

        if (typeof accept !== 'string') {
          continue;
        }

        ctx.contentType = accept;
        ctx.action = action;

        let next: NextFn = action.getNextFn(ctx);

        for (const middleware of this.#middleware.toReversed()) {
          const downstream = next;

          next = async () => {
            await middleware(ctx, downstream);
          };
        }

        await next();

        break;
      }

      return makeResponse(ctx);
    } catch (err) {
      console.log(err);
      
      return new Response(undefined, {
        status: STATUS_CODE.NotFound,
      });
    }
  }

  #callMethod<const Method extends ActionHTTPMethod>(
    method: Method,
    name: string,
    path: string,
    args: RouteArgs = {},
  ): PreAction<State> {
    const rootIRI = this.#rootIRI;
    const actionPathPrefix = this.#urlPattern.pathname;
    const urlPattern = new URLPattern(rootIRI + path);
    const useFileExtensions = typeof args.useFileExtensions === 'boolean'
      ? args.useFileExtensions
      : this.#useFileExtensions;

    const action = new PreAction<State>({
      registry: this as unknown as ActionRegistry<EmptyObject>,
      rootIRI,
      vocab: this.#vocab,
      aliases: this.#aliases,
      actionPathPrefix,
      method,
      name,
      urlPattern,
      ...args,
      useFileExtensions,
    });

    this.#actions.push(action);

    return action;
  }
}
