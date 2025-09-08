import type { AuthMiddleware } from '../auth/types.ts';
import type { Tagger } from '../cache/types.ts';
import type { CacheMiddlewareArgs } from '../cache/cache.ts';


export type HintLink = {
  href: string;
  rel: string | string[];
  type?: string;
  as: string;
  preload?: boolean;
  fetchPriority?: 'high' | 'low' | 'auto';
  crossOrigin?: boolean;
};

export type HintArgs = {
  link: string | HintLink | HintLink[];
  csp?: string;
};
export type Middleware = () => void | Promise<void>;
export type DefinedMiddleware = () => void | Promise<void>;

export interface Action {
  /**
   * Makes this action public.
   */
  public(): AuthedAction;

  /**
   * Implements auth middleware which can optionally allow
   * this action to be available to non logged-in users.
   */
  auth(middleware: AuthMiddleware): AuthedAction;
};

export interface AuthedAction<
> extends CachedAction, DefinedAction {
  hint(args: HintArgs): Action;
  cache(args: CacheMiddlewareArgs): Omit<Action, 'auth' | 'cache' | 'etag'>;
  etag(tagger: Tagger): Omit<Action, 'auth' | 'cache' | 'etag'>;
};

export interface CachedAction<
> extends DefinedAction {
  define(): Action;
};

export interface ActionMiddleware {
  use(middleware: Middleware): AuthedAction;
};

export interface DefinedAction<
> {
  handle(contentType: string, middleware: Middleware): DefinedAction;
  handle(contentType: string[], middleware: Middleware): DefinedAction;
};

export interface DefinedActionMiddleware {
  use(middleware: Middleware): AuthedAction;
};

