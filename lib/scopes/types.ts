import type { AuthMiddleware } from '../auth/types.ts';

export interface Scope {
  auth: AuthMiddleware;
}
