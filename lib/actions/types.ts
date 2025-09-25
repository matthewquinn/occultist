import type { Registry } from '../registry/registry.ts';
import type { Scope } from "../scopes/scopes.ts";
import type { ContextState, ActionSpec } from "./spec.ts";
import type { Context } from "./context.ts";
import { IncomingMessage, ServerResponse } from "node:http";


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
  handleRequest(req: Request, res?: undefined): Promise<Response>;
  handleRequest(req: IncomingMessage, res: ServerResponse): Promise<ServerResponse>;
}

