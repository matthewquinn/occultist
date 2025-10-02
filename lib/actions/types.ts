import type { HTTPWriter } from "./writer.ts";
import type { Registry } from '../registry.ts';
import type { Scope } from "../scopes.ts";
import type { ContextState, ActionSpec } from "./spec.ts";
import type { Context } from "./context.ts";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { JSONObject } from "../jsonld.ts";


export type HandlerMeta = Map<symbol | string, string | string[]>;

export type HandlerFn<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> = (ctx: Context<State, Spec>) => void;

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

export type HintLink = {
  href: string;
  rel?: string | string[];
  type?: string;
  as?: string;
  preload?: boolean;
  fetchPriority?: 'high' | 'low' | 'auto';
  crossOrigin?: boolean;
};

export type HintArgs = {
  link: HintLink | HintLink[];
  csp?: string;
};

export type Middleware = () => void | Promise<void>;

export type DefinedMiddleware = () => void | Promise<void>;

export type HandleFetchRequestArgs = {
  type: 'request';
  contentType?: string;
  language?: string;
  encoding?: string;
  req: Request;
  writer: HTTPWriter;
};

export type HandleNodeHTTPRequestArgs = {
  type: 'node-http';
  contentType?: string;
  language?: string;
  encoding?: string;
  req: IncomingMessage;
  res: ServerResponse;
  writer: HTTPWriter;
};

export type HandleRequestArgs =
  | HandleFetchRequestArgs
  | HandleNodeHTTPRequestArgs
;

export interface ImplementedAction<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> {
  readonly strict: boolean;
  readonly method: string;
  readonly name: string;
  readonly pattern: URLPattern;
  readonly template: string;
  readonly spec: Spec;
  readonly registry: Registry;
  readonly scope?: Scope;
  readonly handlers: Handler<State, Spec>[];
  readonly contentTypes: string[];
  readonly context: JSONObject;

  url(): string;
  handleRequest(args: HandleRequestArgs): Promise<Response | ServerResponse>;
}

