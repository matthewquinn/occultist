import type { HintArgs } from './types.ts';
import type { Registry } from '../registry/registry.ts';
import type { Scope } from "../scopes/scopes.ts";
import type { CacheArgs } from '../cache/cache.ts';
import type { ContextState, ActionSpec } from "./spec.ts";
import type { Context } from "./context.ts";


export class Accept {
  #acceptRe = /([^,; ]+)(;q=(\d(\.\d+)?))?/g;
  accept: string[] = [];
  acceptCache: Set<string> = new Set();
  acceptLanguage: string[] = [];
  acceptLanguageCache: Set<string> = new Set();
  acceptEncoding: string[] = [];
  acceptEncodingCache: Set<string> = new Set();

  constructor(
    accept: string | null,
    acceptLanguage: string | null,
    acceptEncoding: string | null,
  ) {
    [this.accept, this.acceptCache] = this.#process(accept);
    [this.acceptLanguage, this.acceptLanguageCache] = this.#process(acceptLanguage);
    [this.acceptEncoding, this.acceptEncodingCache] = this.#process(acceptEncoding);
  }

  #process(header: string | null): [string[], Set<string>] {
    if (header == null) {
      return [[], new Set('*/*')];
    }

    let match: RegExpExecArray | null;

    const items: Array<{ ct: string, q: number }> = [];
    const cache = new Set<string>();

    while ((match = this.#acceptRe.exec(header))) {
      const ct = match[0];
      const q = Number(match[2] ?? 1);

      cache.add(ct);
      items.push({ ct, q });
    }
    
    return [
      items.toSorted((a, b) => a.q - b.q)
        .map(({ ct }) => ct),
      cache,
    ];
  }
}

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

export type DefineArgs<
  Spec extends ActionSpec = ActionSpec,
> = {
  spec: Spec,
};

export type HandlerFn<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> = (ctx: Context<State, Spec>) => void;

export type HandlerMeta = Map<symbol | string, string | string[]>;

export type HandlerArgs<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> = {
  contentType: string | string[];
  handler: HandlerFn<State, Spec>;
  meta?: Record<symbol | string, string | string[]>;
};

export type TransformerFn = () => void;

export interface Handler<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
  Action extends ImplementedAction<State, Spec> = ImplementedAction<State, Spec>,
> {
  readonly contentType: string;
  readonly name: string;
  readonly meta: HandlerMeta;
  readonly action: Action;
  readonly registry: Registry;
  readonly handler: HandlerFn<State, Spec>;
}

export interface ImplementedAction<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> {
  readonly name: string;
  readonly spec: Spec;
  readonly registry: Registry;
  readonly scope?: Scope;
  readonly handlers: Handler<State, Spec>[];
  readonly contentTypes: string[];

  url(): string;
}

export type Hints =
  | HintArgs
  | ((args: HintArgs) => void)
;

export class ActionMeta<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> {
  method: string;
  name: string;
  path: string;
  hints: HintArgs[] = [];
  transformers: Map<string, TransformerFn> = new Map();
  scope?: Scope;
  registry: Registry;
  action?: ImplementedAction<State, Spec>;
  acceptCache = new Set<string>();
  allowsPublicAccess = false;

  constructor(
    method: string,
    name: string,
    path: string,
    registry: Registry,
    scope?: Scope,
  ) {
    this.method = method;
    this.name = name;
    this.path = path;
    this.scope = scope;
    this.registry = registry;
  }

  /**
   * Called when the API is defined to compute all uncomputed values.
   */
  finalize() {
    this.#setAcceptCache();
  }

  #setAcceptCache(): void {
    const action = this.action;

    if (action == null) {
      return;
    }

    this.acceptCache.add('*/*');

    for (const contentType of action.contentTypes) {
      this.acceptCache.add(contentType);
      this.acceptCache.add(contentType.replace(/[^/]+$/, '*'));
    }
  }
}

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
  #handlers: Handler<State, Spec>[];

  constructor(
    spec: Spec,
    meta: ActionMeta<State, Spec>,
    handlerArgs: HandlerArgs<State, Spec>,
  ) {
    this.#spec = spec;
    this.#meta = meta;

    const handlers: Handler<State, Spec, FinalizedAction<State, Spec>>[] = [];

    if (typeof handlerArgs.contentType === 'string') {
      handlers.push({
        contentType: handlerArgs.contentType,
        handler: handlerArgs.handler,
        meta: new Map(Object.entries(handlerArgs.meta ?? new Map())),
        name: this.#meta.name,
        action: this,
        registry: this.#meta.registry,
      });
    } else {
      for (const item of handlerArgs.contentType) {
        handlers.push({
          contentType: item,
          handler: handlerArgs.handler,
          name: this.#meta.name,
          meta: new Map(Object.entries(handlerArgs.meta ?? new Map())),
          action: this,
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

  get name(): string {
    return this.#meta.name;
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
    return this.#handlers;
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
      this.#handlers.push({
        contentType,
        name: this.#meta.name,
        meta,
        action: this,
        registry: this.#meta.registry,
        handler,
      });
    } else {
      for (const item of contentType) {
        this.#handlers.push({
          contentType: item,
          name: this.#meta.name,
          meta,
          action: this,
          registry: this.#meta.registry,
          handler,
        });
      }
    }

    return this;
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
  }

  get name(): string {
    return this.#meta.name;
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
  }

  get name(): string {
    return this.#meta.name;
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

  url(): string {
    return '';
  }

  use(): Action<State> {
    return this;
  }

  define<
    Spec extends ActionSpec = ActionSpec,
  >(args: DefineArgs<Spec>): DefinedAction<State, Spec> {
    return this.#meta.action = new DefinedAction<State, Spec>(
      args.spec,
      this.#meta as ActionMeta<State, Spec>,
    );
  }

  handle(
    arg1: string | string[] | HandlerArgs<State>,
    arg2?: HandlerFn<State>,
  ): FinalizedAction<State> {
    return this.#meta.action = FinalizedAction.fromHandlers(
      this.#spec,
      this.#meta,
      arg1 as string,
      arg2 as HandlerFn<State>,
    );
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
      this.#meta as ActionMeta<State, Spec>,
    );
  }

  handle(
    arg1: string | string[] | HandlerArgs<State>,
    arg2?: HandlerFn<State>,
  ): FinalizedAction<State> {
    return this.#meta.action = FinalizedAction.fromHandlers(
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
    return this.#meta.action = new DefinedAction<State, Spec>(
      args.spec,
      this.#meta as ActionMeta<State, Spec>,
    );
  }

  handle(
    arg1: string | string[] | HandlerArgs<State>,
    arg2?: HandlerFn<State>,
  ): FinalizedAction<State> {
    return this.#meta.action = FinalizedAction.fromHandlers(
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

  auth(): Endpoint {
    return new Endpoint(this.#meta);
  }

  optionalAuth(): Endpoint {
    this.#meta.allowsPublicAccess = true;

    return new Endpoint(this.#meta);
  }
}

