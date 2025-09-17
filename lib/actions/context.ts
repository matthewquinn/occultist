import type { ReadStream } from "node:fs";
import type { Handler, ImplementedAction } from "./actions.ts";
import type { Registry } from "../registry/registry.ts";
import type { JSONValue } from "../jsonld.ts";
import type { ActionSpec, ContextState, ObjectSpec, ObjectArraySpec, PropertySpecResult } from "./spec.ts";



export interface WrappedRequest {
  readonly body: ReadableStream;
  readonly headers: Headers;
}

export interface WrappedResponse {
  status?: number;
  statusText?: string;
  body: string | Blob | BufferSource | ReadStream | JSONValue;
  contentType?: string;
  readonly headers: Headers;
};

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
  iri: string;
  public: boolean;
  authKey: string;
  handler: Handler<State, Spec>;
  request: WrappedRequest;
  response: WrappedResponse;
};

export class Context<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> {

  status?: number;
  statusText?: string;

  #iri: string;
  #public: boolean = false
  #authKey?: string;
  #state: State = new Map() as State;
  #action: ImplementedAction<State, Spec>;
  #registry: Registry;
  #handler: Handler<State, Spec>;
  #request: WrappedRequest;
  #response: WrappedResponse;

  constructor(args: ContextArgs<State, Spec>) {
    this.#iri = args.iri;
    this.#public = args.public;
    this.#authKey = args.authKey;
    this.#handler = args.handler;
    this.#action = args.handler.action;
    this.#registry = args.handler.registry;
    this.#request = args.request;
    this.#response = args.response;
  }

  get public(): boolean {
    return this.#public;
  }

  get authKey(): string | undefined {
    return this.#authKey;
  }

  get iri(): string {
    return this.#iri;
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

  get handler(): Handler<State, Spec> {
    return this.#handler;
  }

  get request(): WrappedRequest {
    return this.#request;
  }

  get response(): WrappedResponse {
    return this.#response;
  }

  get payload(): ActionPayload<Spec> {
    throw new Error('Not defined');
  }

}

