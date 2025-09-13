import type { ReadStream } from "node:fs";
import type { FinalizedAction, Handler, DefinedAction, ImplementedAction, Action } from "./actions.ts";
import type { Registry } from "../registry/registry.ts";
import type { JSONValue } from "../jsonld.ts";
import type { ActionSpec, ContextState } from "./spec.ts";


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

export type ContextArgs<
  Action extends ImplementedAction = ImplementedAction,
> = {
  iri: string;
  public: boolean;
  authKey: string;
  handler: Handler<Action>;
  request: WrappedRequest;
  response: WrappedResponse;
};

export class Context<
  State extends ContextState = ContextState,
> {

  #iri: string;
  status?: number;
  statusText?: string;
  #public: boolean = false
  #authKey?: string;
  #state: State = new Map() as State;
  #action: ImplementedAction;
  #registry: Registry;
  #handler: Handler<Action>;
  #request: WrappedRequest;
  #response: WrappedResponse;

  constructor(args: ContextArgs<Action>) {
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

  get action(): ImplementedAction {
    return this.#action;
  }

  get registry(): Registry {
    return this.#registry;
  }

  get handler(): Handler {
    return this.#handler;
  }

  get request(): WrappedRequest {
    return this.#request;
  }

  get response(): WrappedResponse {
    return this.#response;
  }

}

export class ParameterizedContext<
  State extends ContextState = ContextState,
  Spec extends ActionSpec<State> = ActionSpec<State>,
> extends Context<State> {

  constructor(args: ContextArgs<DefinedAction<Spec> | FinalizedAction<Spec>>) {
    super(args);
  }

};
