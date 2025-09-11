import type { ImplementedAction, Handler } from "../actions/types.ts";

export interface Registry {
  readonly actions: ImplementedAction[];
  readonly handlers: Handler[];
}