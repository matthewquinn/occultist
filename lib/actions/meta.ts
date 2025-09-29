import type { Registry } from '../registry.ts';
import type { HintArgs, ImplementedAction } from './types.ts';
import type { ContextState, ActionSpec } from './spec.ts';
import type { Scope } from "../scopes.ts";
import type { Path } from "./path.ts";
import type { HTTPWriter } from "./writer.ts";

export type TransformerFn = () => void;

export class ActionMeta<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> {
  rootIRI: string;
  method: string;
  name: string;
  pathTemplate: string;
  path?: Path;
  hints: HintArgs[] = [];
  transformers: Map<string, TransformerFn> = new Map();
  scope?: Scope;
  registry: Registry;
  writer: HTTPWriter;
  action?: ImplementedAction<State, Spec>;
  acceptCache = new Set<string>();
  allowsPublicAccess = false;

  constructor(
    rootIRI: string,
    method: string,
    name: string,
    pathTemplate: string,
    registry: Registry,
    writer: HTTPWriter,
    scope?: Scope,
  ) {
    this.rootIRI = rootIRI;
    this.method = method;
    this.name = name;
    this.pathTemplate = pathTemplate;
    this.registry = registry;
    this.writer = writer;
    this.scope = scope;
  }

  /**
   * Called when the API is defined to compute all uncomputed values.
   */
  finalize() {
    this.#setAcceptCache();
  }

  #setAcceptCache(): void {
    const action = this.action;

    if (action == null) {
      return;
    }

    this.acceptCache.add('*/*');

    for (const contentType of action.contentTypes) {
      this.acceptCache.add(contentType);
      this.acceptCache.add(contentType.replace(/[^/]+$/, '*'));
    }
  }
}
