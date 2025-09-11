import type { HintArgs } from './types.ts';
import type { Registry } from '../registry/types.ts';
import type { Scope } from "../scopes/types.ts";

export type HandlerFn = () => void;

export type HandlerMeta = Map<symbol | string, string | string[]>;

export type HandlerArgs = {
  contentType: string | string[];
  handler: HandlerFn;
  meta?: HandlerMeta;
};

export type TransformerFn = () => void;

export interface Handler {
  readonly contentType: string;
  readonly name: string;
  readonly meta: HandlerMeta;
  readonly action: ImplementedAction;
  readonly registry: Registry;
  readonly handler: HandlerFn;
}

export interface ImplementedAction {
  readonly name: string;
  // readonly partial: JSONObject;
  // readonly representation: JSONObject;
  readonly registry: Registry;
  readonly scope: Scope;
  readonly handlers: Handler[];
}

export class ActionMeta {
  name: string;
  path: string;
  method: string;
  hints: HintArgs[] = [];
  transformers: Map<string, TransformerFn> = new Map();
  scope: Scope;
  registry: Registry;

  constructor(
    name: string,
    path: string,
    method: string,
    scope: Scope,
    registry: Registry,
  ) {
    this.name = name;
    this.path = path;
    this.method = method;
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

export class FinalizedAction implements
  Handleable<FinalizedAction>,
  ImplementedAction
{
  #meta: ActionMeta;
  #handlers: Handler[];

  constructor(
    meta: ActionMeta,
    contentType: string | string[],
    handler: HandlerFn,
  ) {
    this.#meta = meta;

    const handlers: Handler[] = [];

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

  get name() {
    return this.#meta.name;
  }

  get scope() {
    return this.#meta.scope
  }

  get registry() {
    return this.#meta.registry;
  }
  
  get handlers() {
    return this.#handlers;
  }
  
  handle(
    contentType: string | string[],
    handler: HandlerFn,
  ): FinalizedAction {
    if (!Array.isArray(contentType)) {
      this.#handlers.push({
        contentType,
        name: this.#meta.name,
        action: this,
        registry: this.#meta.registry,
        handler,
      });
    } else {
      for (const item of contentType) {
        this.#handlers.push({
          contentType: item,
          name: this.#meta.name,
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

export class DefinedAction implements
  Applicable<DefinedAction>,
  Handleable<FinalizedAction>
{
  #meta: ActionMeta;

  constructor(
    meta: ActionMeta,
  ) {
    this.#meta = meta;
  }

  get name() {
    return this.#meta;
  }

  get scope() {
    return this.#meta.scope;
  }

  get registry() {
    return this.#meta.registry;
  }

  get handlers() {
    return [];
  }
 
  use(): DefinedAction {
    return this;
  }

  handle(
    contentType: string | string[],
    handler: HandlerFn,
  ): FinalizedAction {
    return new FinalizedAction(
      this.#meta,
      contentType,
      handler,
    );
  }
}

export interface Definable<ActionType> {
  define(): ActionType;
}

export class Action implements
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

  get name() {
    return this.#meta;
  }

  get scope() {
    return this.#meta.scope;
  }

  get registry() {
    return this.#meta.registry;
  }
  
  get handlers() {
    return [];
  }

  use(): Action {
    return this;
  }

  define(): DefinedAction {
    return new DefinedAction(
      this.#meta,
    );
  }

  handle(
    contentType: string | string[],
    handler: HandlerFn,
  ): FinalizedAction {
    return new FinalizedAction(
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

  define() {
    return new DefinedAction(
      this.#meta,
    );
  }

  handle(
    contentType: string | string[],
    handler: HandlerFn,
  ): FinalizedAction {
    return new FinalizedAction(
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

  use() {
    return new Action(
      this.#meta,
    );
  }

  define() {
    return new DefinedAction(
      this.#meta,
    );
  }

  handle(
    contentType: string | string[],
    handler: HandlerFn,
  ): FinalizedAction {
    return new FinalizedAction(
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

  public() {
    return new Endpoint(this.#meta);
  }

  auth() {
    return new Endpoint(this.#meta);
  }
}
