import type { Handler, HandleRequestArgs, HandlerFn, HandlerMeta, HintArgs, ImplementedAction } from './types.ts';
import type { Registry } from '../registry.ts';
import type { Scope } from "../scopes.ts";
import type { CacheArgs } from '../cache/cache.ts';
import type { ContextState, ActionSpec } from "./spec.ts";
import type { ActionMeta } from "./meta.ts";
import { Context } from './context.ts';
import { processAction } from "../processAction.ts";
import type { JSONObject } from "../jsonld.ts";

export type TransformerFn = () => void;
export type DefineArgs<
  Spec extends ActionSpec = ActionSpec,
> = {
  spec: Spec,
};

export type HandlerArgs<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> = {
  contentType: string | string[];
  handler: HandlerFn<State, Spec>;
  meta?: Record<symbol | string, string | string[]>;
};

export type Hints =
  | HintArgs
  | ((args: HintArgs) => void)
;

export interface Handleable<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> {
  handle(
    contentType: string | string[],
    handler: HandlerFn<State, Spec>,
  ): FinalizedAction<State, Spec>;

  handle(
    args: HandlerArgs<State, Spec>,
  ): FinalizedAction<State, Spec>;
}

export class FinalizedAction<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> implements
  Handleable<State, Spec>,
  ImplementedAction<State, Spec>
{
  #spec: Spec;
  #meta: ActionMeta<State, Spec>;
  #handlers: Map<string, Handler<State, Spec, ImplementedAction<State, Spec>>>;

  constructor(
    spec: Spec,
    meta: ActionMeta<State, Spec>,
    handlerArgs: HandlerArgs<State, Spec>,
  ) {
    this.#spec = spec;
    this.#meta = meta;

    this.#meta.action = this;

    const handlers: Map<string, Handler<State, Spec, ImplementedAction<State, Spec>>> = new Map();

    if (typeof handlerArgs.contentType === 'string') {
      handlers.set(handlerArgs.contentType, {
        contentType: handlerArgs.contentType,
        handler: handlerArgs.handler,
        meta: new Map(Object.entries(handlerArgs.meta ?? new Map())),
        name: this.#meta.name,
        action: this as unknown as ImplementedAction<State, Spec>,
        registry: this.#meta.registry,
      });
    } else {
      for (const item of handlerArgs.contentType) {
        handlers.set(item, {
          contentType: item,
          handler: handlerArgs.handler,
          name: this.#meta.name,
          meta: new Map(Object.entries(handlerArgs.meta ?? new Map())),
          action: this as unknown as ImplementedAction<State, Spec>,
          registry: this.#meta.registry,
        });
      }
    }

    this.#handlers = handlers;
  }

  static fromHandlers<
    State extends ContextState = ContextState,
    Spec extends ActionSpec = ActionSpec,
  >(
    spec: Spec,
    meta: ActionMeta<State, Spec>,
    contextType: string | string[],
    handler: HandlerFn<State, Spec>,
  ): FinalizedAction<State, Spec>;

  static fromHandlers<
    State extends ContextState = ContextState,
    Spec extends ActionSpec = ActionSpec,
  >(
    spec: Spec,
    meta: ActionMeta<State, Spec>,
    handlerArgs: HandlerArgs<State, Spec>,
  ): FinalizedAction<State, Spec>;

  static fromHandlers<
    State extends ContextState = ContextState,
    Spec extends ActionSpec = ActionSpec,
  >(
    spec: Spec,
    meta: ActionMeta<State, Spec>,
    arg3: string | string[] | HandlerArgs<State, Spec>,
    arg4?: HandlerFn<State, Spec>,
  ): FinalizedAction<State, Spec> {
    if (Array.isArray(arg3) || typeof arg3 === 'string') {
      return new FinalizedAction<State, Spec>(
        spec,
        meta,
        { contentType: arg3, handler: arg4 as HandlerFn<State, Spec> },
      );
    }

    return new FinalizedAction(spec, meta, arg3);
  }

  get method(): string {
    return this.#meta.method;
  }

  get name(): string {
    return this.#meta.name;
  }

  get template(): string {
    return this.#meta.uriTemplate;
  }

  get pattern(): URLPattern {
    return this.#meta.path.pattern;
  }

  get spec(): Spec {
    return this.#spec;
  }

  get scope(): Scope | undefined {
    return this.#meta.scope
  }

  get registry(): Registry {
    return this.#meta.registry;
  }
  
  get handlers(): Handler<State, Spec>[] {
    return Array.from(this.#handlers.values());
  }

  get contentTypes(): string[] {
    return Array.from(this.#handlers.keys());
  }

  get context(): JSONObject {
    return {};
  }
 
  url(): string {
    return '';
  }

  handle(
    contentType: string | string[],
    handler: HandlerFn<State, Spec>,
  ): FinalizedAction<State, Spec>;

  handle(
    args: HandlerArgs<State, Spec>,
  ): FinalizedAction<State, Spec>;
  
  handle(
    arg1: string | string[] | HandlerArgs<State, Spec>,
    arg2?: HandlerFn<State, Spec>,
  ): FinalizedAction<State, Spec> {
    let contentType: string | string[];
    let handler: HandlerFn<State, Spec>;
    let meta: HandlerMeta;

    if (Array.isArray(arg1) || typeof arg1 === 'string') {
      contentType = arg1;
      handler = arg2 as HandlerFn<State, Spec>;
      meta = new Map();
    } else {
      contentType = arg1.contentType;
      handler = arg1.handler;
      meta = new Map(Object.entries(arg1.meta ?? {}));
    }

    if (!Array.isArray(contentType)) {
      this.#handlers.set(contentType, {
        contentType,
        name: this.#meta.name,
        meta,
        action: this as unknown as ImplementedAction<State, Spec>,
        registry: this.#meta.registry,
        handler,
      });
    } else {
      for (const item of contentType) {
        this.#handlers.set(item, {
          contentType: item,
          name: this.#meta.name,
          meta,
          action: this as unknown as ImplementedAction<State, Spec>,
          registry: this.#meta.registry,
          handler,
        });
      }
    }

    return this;
  }

  async handleRequest(args: HandleRequestArgs) {
    const handler = this.#handlers.get(args.contentType as string) as Handler<State, Spec>;
    const { params, query, payload } = await processAction<State, Spec>({
      iri: args.req.url,
      req: args.req,
      spec: this.#spec,
      state: {} as State,
      action: this as unknown as ImplementedAction<State, Spec>,
    });

    const context = new Context({
      url: args.req.url,
      public: this.#meta.allowsPublicAccess,
      handler,
      params,
      query,
      payload,
    });

    await handler.handler(context);

    args.writer.writeHead(context.status ?? 200, context.headers);
    args.writer.writeBody(context.body);

    return args.writer.response();
  }
}

export interface Applicable<ActionType> {
  use(): ActionType;
}

export class DefinedAction<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> implements
  Applicable<DefinedAction<State, Spec>>,
  Handleable<State, Spec>,
  ImplementedAction<State, Spec>
{
  #spec: Spec;
  #meta: ActionMeta<State, Spec>;

  constructor(
    spec: Spec,
    meta: ActionMeta<State, Spec>,
  ) {
    this.#spec = spec;
    this.#meta = meta;

    this.#meta.action = this as unknown as ImplementedAction<State, Spec>;
  }

  get method(): string {
    return this.#meta.method;
  }

  get name(): string {
    return this.#meta.name;
  }

  get path(): string {
    return this.#meta.pathTemplate;
  }

  get spec(): Spec {
    return this.#spec;
  }

  get scope(): Scope | undefined {
    return this.#meta.scope;
  }

  get registry(): Registry {
    return this.#meta.registry;
  }

  get handlers(): Handler<State, Spec>[] {
    return [];
  }

  get contentTypes(): string[] {
    return [];
  }
 
  url(): string {
    return '';
  }

  use(): DefinedAction<State, Spec> {
    return this;
  }

  handle(
    contentType: string | string[],
    handler: HandlerFn<State, Spec>,
  ): FinalizedAction<State, Spec>;

  handle(
    args: HandlerArgs<State, Spec>,
  ): FinalizedAction<State, Spec>;

  handle(
    arg1: string | string[] | HandlerArgs<State, Spec>,
    arg2?: HandlerFn<State, Spec>,
  ): FinalizedAction<State, Spec> {
    return FinalizedAction.fromHandlers(
      this.#spec,
      this.#meta,
      arg1 as string,
      arg2 as HandlerFn<State, Spec>,
    );
  }

  async handleRequest(_args: HandleRequestArgs) {
    throw new Error('Not implemented');
  }
}

export class Action<
  State extends ContextState = ContextState,
> implements
  Applicable<Action>,
  Handleable<State>,
  ImplementedAction<State>
{
  #spec: ActionSpec = {};
  #meta: ActionMeta<State>;

  constructor(
    meta: ActionMeta<State>,
  ) {
    this.#meta = meta;

    this.#meta.action = this;
  }

  get method(): string {
    return this.#meta.method;
  }

  get name(): string {
    return this.#meta.name;
  }

  get path(): string {
    return this.#meta.pathTemplate;
  }

  get spec(): ActionSpec {
    return this.#spec;
  }

  get scope(): Scope | undefined {
    return this.#meta.scope;
  }

  get registry(): Registry {
    return this.#meta.registry;
  }
  
  get handlers(): Handler[] {
    return [];
  }

  get contentTypes(): string[] {
    return [];
  }

  url(): string {
    return '';
  }

  use(): Action<State> {
    return this;
  }

  define<
    Spec extends ActionSpec = ActionSpec,
  >(args: DefineArgs<Spec>): DefinedAction<State, Spec> {
    return new DefinedAction<State, Spec>(
      args.spec,
      this.#meta as unknown as ActionMeta<State, Spec>,
    );
  }

  handle(
    arg1: string | string[] | HandlerArgs<State>,
    arg2?: HandlerFn<State>,
  ): FinalizedAction<State> {
    return FinalizedAction.fromHandlers(
      this.#spec,
      this.#meta,
      arg1 as string,
      arg2 as HandlerFn<State>,
    );
  }

  async handleRequest(_args: HandleRequestArgs) {
    throw new Error('Not implemented');
  }
}

export class PreAction<
  State extends ContextState = ContextState,
> implements
  Applicable<Action>,
  Handleable<State>
{
  #meta: ActionMeta<State>;

  constructor(
    meta: ActionMeta,
  ) {
    this.#meta = meta;
  }

  use() {
    return new Action(
      this.#meta,
    );
  }

  define<
    Spec extends ActionSpec = ActionSpec,
  >(args: DefineArgs<Spec>): DefinedAction<State, Spec> {
    return new DefinedAction<State, Spec>(
      args.spec,
      this.#meta as unknown as ActionMeta<State, Spec>,
    );
  }

  handle(
    arg1: string | string[] | HandlerArgs<State>,
    arg2?: HandlerFn<State>,
  ): FinalizedAction<State> {
    return FinalizedAction.fromHandlers(
      {},
      this.#meta,
      arg1 as string,
      arg2 as HandlerFn<State>,
    );
  }
}

export class Endpoint<
  State extends ContextState = ContextState,
> implements
  Applicable<Action>,
  Handleable<State>
{
  #meta: ActionMeta<State>;

  constructor(
    meta: ActionMeta,
  ) {
    this.#meta = meta;
  }
  
  hint(hints: HintArgs | ((hints: HintArgs) => void)): Endpoint<State> {
    this.#meta.hints.push(hints);

    return this;
  }

  transform(
    contentType: string | string[],
    transformer: TransformerFn,
  ) {
    if (!Array.isArray(contentType)) {
      this.#meta.transformers.set(contentType, transformer);
    } else {
      for (const item of contentType) {
        this.#meta.transformers.set(item, transformer);
      }
    }

    return this;
  }

  compress(): Endpoint<State> {
    return this;
  }
  
  cache<
    StorageKey extends string = string,
  >(args: CacheArgs<StorageKey>) {
    return this;
  }

  etag() {
    return this;
  }

  use(): Action<State> {
    return this.#meta.action = new Action(
      this.#meta,
    );
  }

  define<
    Spec extends ActionSpec = ActionSpec,
  >(args: DefineArgs<Spec>): DefinedAction<State, Spec> {
    return new DefinedAction<State, Spec>(
      args.spec,
      this.#meta as ActionMeta<State, Spec>,
    );
  }

  handle(
    arg1: string | string[] | HandlerArgs<State>,
    arg2?: HandlerFn<State>,
  ): FinalizedAction<State> {
    return FinalizedAction.fromHandlers(
      {},
      this.#meta,
      arg1 as string,
      arg2 as HandlerFn<State>,
    );
  }
}

export class ActionAuth {
  #meta: ActionMeta;

  constructor(meta: ActionMeta) {
    this.#meta = meta;
  }

  public(): Endpoint {
    this.#meta.allowsPublicAccess = true;
    
    return new Endpoint(this.#meta);
  }

  private(): Endpoint {
    return new Endpoint(this.#meta);
  }

}

