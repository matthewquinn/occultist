import type { ReadStream } from "node:fs";
import type { Handler, ImplementedAction } from "./types.ts";
import type { Registry } from "../registry.ts";
import type { JSONValue } from "../jsonld.ts";
import type { ActionSpec, ContextState, ObjectSpec, ObjectArraySpec, PropertySpecResult } from "./spec.ts";


export type ActionPayload<
  Spec extends ActionSpec = ActionSpec,
> = {
  [
    Term in keyof Spec as Spec[Term] extends { internalTerm: string }
      ? Spec[Term]['internalTerm']
      : Term
  ]: Spec[Term] extends ObjectArraySpec
    ? Array<ActionPayload<Spec[Term]['properties']>>
    : Spec[Term] extends ObjectSpec ? ActionPayload<Spec[Term]['properties']>
    : PropertySpecResult<Spec[Term]>;
};

export type ContextArgs<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> = {
  url: string;
  public: boolean;
  authKey?: string;
  handler: Handler<State, Spec>;
};

export class Context<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> {

  status?: number;
  statusText?: string;
  headers = new Headers();
  body?: null | string | Blob | Uint8Array | ReadStream;

  #url: string;
  #public: boolean = false
  #authKey?: string;
  #state: State = new Map() as State;
  #action: ImplementedAction<State, Spec>;
  #registry: Registry;

  constructor(args: ContextArgs<State, Spec>) {
    this.#url = args.url;
    this.#public = args.public;
    this.#authKey = args.authKey;
    this.#action = args.handler.action;
    this.#registry = args.handler.registry;
  }

  get public(): boolean {
    return this.#public;
  }

  get authKey(): string | undefined {
    return this.#authKey;
  }

  get url(): string {
    return this.#url;
  }

  get state(): State {
    return this.#state;
  }

  get action(): ImplementedAction<State, Spec> {
    return this.#action;
  }

  get registry(): Registry {
    return this.#registry;
  }

  get payload(): ActionPayload<Spec> {
    throw new Error('Not defined');
  }

}

