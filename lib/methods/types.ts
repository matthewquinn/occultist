
import type { Action, ContentAction } from '../actions/types.ts';

export interface HTTPMethod {
  (path: string): Action;
  (contentType: string, path: string): ContentAction;
  (contentTypes: string[], path: string): ContentAction;
};

export interface Methods {
  trace: HTTPMethod;
  options: HTTPMethod;
  head: HTTPMethod;
  get: HTTPMethod;
  post: HTTPMethod;
  put: HTTPMethod;
  patch: HTTPMethod;
  delete: HTTPMethod;
  connect: HTTPMethod;
  mkcol: HTTPMethod;
  move: HTTPMethod;
  copy: HTTPMethod;
  lock: HTTPMethod;
  unlock: HTTPMethod;
  propfind: HTTPMethod;
  proppatch: HTTPMethod;
  method(methodName: string): HTTPMethod;
};
