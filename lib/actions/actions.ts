import type { HintArgs } from './types.ts';
import type { Registry } from '../registry/registry.ts';
import type { Scope } from "../scopes/scopes.ts";
import { ActionSpec } from "./spec.ts";

export type HandlerFn = () => void;

export type HandlerMeta = Map<symbol | string, string | string[]>;

export type HandlerArgs = {
  contentType: string | string[];
  handler: HandlerFn;
  meta?: Record<symbol | string, string | string[]>;
};

export type TransformerFn = () => void;

export interface Handler<
  Action extends ImplementedAction = ImplementedAction,
> {
  readonly contentType: string;
  readonly name: string;
  readonly meta: HandlerMeta;
  readonly action: Action;
  readonly registry: Registry;
  readonly handler: HandlerFn;
}

export interface ImplementedAction {
  readonly name: string;
  // readonly partial: JSONObject;
  // readonly representation: JSONObject;
  readonly registry: Registry;
  readonly scope?: Scope;
  readonly handlers: Handler[];
}

export class ActionMeta<
  Spec extends ActionSpec = ActionSpec,
> {
  method: string;
  name: string;
  path: string;
  hints: HintArgs[] = [];
  transformers: Map<string, TransformerFn> = new Map();
  scope?: Scope;
  registry: Registry;
  action?: ImplementedAction;

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

export interface Handleable<ActionType> {
  handle(
    contentType: string | string[],
    handler: HandlerFn,
  ): ActionType;
}

export class FinalizedAction<
  Spec extends ActionSpec = ActionSpec,
> implements
  Handleable<FinalizedAction<Spec>>,
  ImplementedAction<Spec>
{
  #meta: ActionMeta;
  #handlers: Handler<Spec>[];

  constructor(
    meta: ActionMeta,
    contentType: string | string[],
    handler: HandlerFn<Spec>,
  ) {
    this.#meta = meta;

    const handlers: Handler<Spec>[] = [];

    if (!Array.isArray(contentType)) {
      handlers.push({
        contentType,
        name: this.#meta.name,
        meta: new Map(),
        action: this,
        registry: this.#meta.registry,
        handler,
      });
    } else {
      for (const item of contentType) {
        handlers.push({
          contentType: item,
          name: this.#meta.name,
          meta: new Map(),
          action: this,
          registry: this.#meta.registry,
          handler,
        });
      }
    }

    this.#handlers = handlers;
  }

  get name(): string {
    return this.#meta.name;
  }

  get scope(): Scope | undefined {
    return this.#meta.scope
  }

  get registry(): Registry {
    return this.#meta.registry;
  }
  
  get handlers(): Handler<Spec>[] {
    return this.#handlers;
  }

  handle(
    contentType: string | string[],
    handler: HandlerFn<Spec>,
  ): FinalizedAction;

  handle(
    args: HandlerArgs<Spec>,
  ): FinalizedAction<Spec>;
  
  handle(
    arg1: string | string[] | HandlerArgs<Spec>,
    arg2?: HandlerFn<Spec>,
  ): FinalizedAction<Spec> {
    let contentType: string | string[];
    let handler: HandlerFn<Spec>;
    let meta: HandlerMeta<Spec>;

    if (Array.isArray(arg1) || typeof arg1 === 'string') {
      contentType = arg1;
      handler = arg2 as HandlerFn<Spec>;
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
  Spec extends ActionSpec = ActionSpec,
> implements
  Applicable<DefinedAction<Spec>>,
  Handleable<FinalizedAction<Spec>>,
  ImplementedAction<Spec>
{
  #meta: ActionMeta;

  constructor(
    meta: ActionMeta,
  ) {
    this.#meta = meta;
  }

  get name(): string {
    return this.#meta.name;
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
 
  use(): DefinedAction<Spec> {
    return this;
  }

  handle(
    contentType: string | string[],
    handler: HandlerFn,
  ): FinalizedAction<Spec> {
    return this.#meta.action = new FinalizedAction<Spec>(
      this.#meta,
      contentType,
      handler,
    );
  }
}

export class Action implements
  Applicable<Action>,
  Handleable<FinalizedAction>,
  ImplementedAction
{
  #meta: ActionMeta;

  constructor(
    meta: ActionMeta,
  ) {
    this.#meta = meta;
  }

  get name(): string {
    return this.#meta.name;
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

  use(): Action {
    return this;
  }

  define<
    Spec extends ActionSpec = ActionSpec,
  >(): DefinedAction<Spec> {
    return this.#meta.action = new DefinedAction<Spec>(
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

