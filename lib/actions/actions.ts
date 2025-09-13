import type { HintArgs } from './types.ts';
import type { Registry } from '../registry/registry.ts';
import type { Scope } from "../scopes/scopes.ts";
import type { ContextState, ActionSpec } from "./spec.ts";
import type { Context } from "./context.ts";
import { HandleArgs } from "../types.ts";

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
}

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

  use(): Action<State> {
    return this;
  }

  define<
    Spec extends ActionSpec = ActionSpec,
  >(spec: Spec): DefinedAction<State, Spec> {
    return this.#meta.action = new DefinedAction<State, Spec>(
      spec,
      this.#meta as ActionMeta<State, Spec>,
    );
  }

  handle(
    contentType: string | string[],
    handler: HandlerFn<State>,
  ): FinalizedAction<State>;

  handle(
    args: HandleArgs<State>,
  ): FinalizedAction<State>;

  handle(
    arg1: string | string[] | HandleArgs<State>,
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

export class PreAction implements
  Applicable<Action>,
  Definable<DefinedAction>,
  Handleable<FinalizedAction>
{
  #meta: ActionMeta;

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

  define(): DefinedAction {
    return this.#meta.action = new DefinedAction(
      this.#meta,
    );
  }

  handle(
    contentType: string | string[],
    handler: HandlerFn,
  ): FinalizedAction {
    return this.#meta.action = new FinalizedAction(
      this.#meta,
      contentType,
      handler,
    );
  }
}

export class Endpoint implements
  Applicable<Action>,
  Definable<DefinedAction>,
  Handleable<FinalizedAction>
{
  #meta: ActionMeta;

  constructor(
    meta: ActionMeta,
  ) {
    this.#meta = meta;
  }
  
  hint(hints: HintArgs) {
    this.#meta.hints.push(hints);
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
  
  cache() {
    return this;
  }

  etag() {
    return this;
  }

  use(): Action {
    return this.#meta.action = new Action(
      this.#meta,
    );
  }

  define(): DefinedAction {
    return this.#meta.action = new DefinedAction(
      this.#meta,
    );
  }

  handle(
    contentType: string | string[],
    handler: HandlerFn,
  ): FinalizedAction {
    return this.#meta.action = new FinalizedAction(
      this.#meta,
      contentType,
      handler,
    );
  }
}

export class ActionAuth {
  #meta: ActionMeta;

  constructor(meta: ActionMeta) {
    this.#meta = meta;
  }

  public(): Endpoint {
    return new Endpoint(this.#meta);
  }

  auth(): Endpoint {
    return new Endpoint(this.#meta);
  }
}

