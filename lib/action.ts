import { accepts, STATUS_CODE } from '@std/http';
import type { Aliases, EmptyObject, JSONLDContext, JSONObject, Merge, TypeDef } from "./jsonld.ts";
import { processAction } from "./processAction.ts";
import type { ActionRegistry } from "./registry.ts";
import type { Action, ActionCompatibility, ActionHTTPMethod, ActionPayload, ActionSpec, Context, ContextState, Middleware, NextFn, ParameterizedContext, ParameterizedMiddleware, HandleArgs, ParameterizedHandleArgs, HandlerDescription, HandlerMetadata } from "./types.ts";
import { getActionContext } from "./utils/getActionContext.ts";
import { getPropertyValueSpecifications } from "./utils/getPropertyValueSpecifications.ts";
import { makeResponse } from "./utils/makeResponse.ts";
import { urlToIRI } from "./utils/urlToIRI.ts";
import { isObject } from './utils/isObject.ts';

export function joinPaths(...paths: Array<string | number>): string {
  let fullPath: string = '';

  if (typeof paths[0] !== 'string' || paths[0].length === 0) {
    throw new Error(
      'The first path must be a populated string when joining paths',
    );
  }

  for (const pathSrc of paths) {
    let path: string | null = null;

    if (typeof pathSrc === 'number') {
      path = `${pathSrc}`;
    } else if (typeof pathSrc === 'string') {
      path = pathSrc;
    }

    if (typeof path !== 'string' || path.length === 0) {
      continue;
    }

    if (fullPath === '') {
      fullPath = path as string;
    } else if (fullPath.endsWith('/') && path.startsWith('/')) {
      fullPath += path.replace(/^\//, '');
    } else if (fullPath.endsWith('/') || path.startsWith('/')) {
      fullPath += path;
    } else {
      fullPath += `/${path}`;
    }
  }

  return fullPath;
}

export enum ContentType {
  TextPlain = 'text/plain',
  TextHTML = 'text/html; charset=utf-8',
  TextCSS = 'text/css',
  TextJavascript = 'text/javascript',
  ApplicationXWWWFormURLEncoded = 'application/x-www-form-urlencoded',
  MultipartFormData = 'multipart/form-data',
  ApplicationJSON = 'application/json',
  ApplicationCBOR = 'application/cbor',
  ApplicationXML = 'application/xml',
  ApplicationJSONLD = 'application/ld+json',
  ApplicationCBORLD = 'application/ld+cbor',
  ApplicationProblemJSON = 'application/problem+json',
  ApplicationProblemXML = 'application/problem+xml',
  TextTurtle = 'text/turtle',
  ApplicationRDFXML = 'application/rdf+xml',
  ApplicationNQuads = 'application/n-quads',
  ApplicationPDF = 'application/pdf',
  ImageJPEG = 'image/jpeg',
  ImagePNG = 'image/png',
};

export const FileExtension = {
  'html': ContentType.TextHTML,
  'css': ContentType.TextCSS,
  'js': ContentType.TextJavascript,
  'ttl': ContentType.TextTurtle,
  'json': ContentType.ApplicationJSON,
  'cbor': ContentType.ApplicationCBOR,
  'xml': ContentType.ApplicationXML,
  'jsonld': ContentType.ApplicationJSONLD,
  'cborld': ContentType.ApplicationCBORLD,
  'rdf': ContentType.ApplicationRDFXML,
  'pdf': ContentType.ApplicationPDF,
} as const;

export type PreActionArgs = {
  registry: ActionRegistry;
  rootIRI: string;
  name: string;
  method: ActionHTTPMethod;
  urlPattern: URLPattern;
  vocab?: string;
  aliases?: Aliases;
  actionPathPrefix: string;
  useFileExtensions?: boolean;
  extensionsParam?: string;
  extensions?: Record<string, string>;
};

export type UnExposedPostActionArgs<
  // deno-lint-ignore no-explicit-any
  Term extends string = any,
  Compatibility extends ActionCompatibility = ActionCompatibility,
  State extends ContextState = EmptyObject,
  Spec extends ActionSpec<State> = ActionSpec<State>,
  OriginalState extends ContextState = ContextState,
> = {
  expose: false;
  contentTypes?: Compatibility;
  strict?: boolean;
  vocab?: string;
  aliases?: Aliases;
  typeDef?: TypeDef<Term>;
  spec?: Spec;
  // deno-lint-ignore no-explicit-any
  pre: PreAction<any, OriginalState>;
};

export type ExposedPostActionArgs<
  // deno-lint-ignore no-explicit-any
  Term extends string = any,
  Compatibility extends ActionCompatibility = ActionCompatibility,
  State extends ContextState = EmptyObject,
  Spec extends ActionSpec<State> = ActionSpec<State>,
  OriginalState extends ContextState = ContextState,
> = {
  expose?: true;
  contentTypes?: Compatibility;
  strict?: boolean;
  vocab?: string;
  aliases?: Aliases;
  typeDef?: TypeDef<Term>;
  spec?: Spec;
  // deno-lint-ignore no-explicit-any
  pre: PreAction<any, OriginalState>;
};

export type PostActionArgs<
  // deno-lint-ignore no-explicit-any
  Term extends string = any,
  Compatibility extends ActionCompatibility = ActionCompatibility,
  State extends ContextState = EmptyObject,
  Spec extends ActionSpec<State> = ActionSpec<State>,
  OriginalState extends ContextState = ContextState,
> =
  | UnExposedPostActionArgs<Term, Compatibility, State, Spec, OriginalState>
  | ExposedPostActionArgs<Term, Compatibility, State, Spec, OriginalState>;

export type TypedActionArgs<
  // deno-lint-ignore no-explicit-any
  Term extends string = any,
  Compatibility extends ActionCompatibility = ActionCompatibility,
  State extends ContextState = EmptyObject,
  Spec extends ActionSpec<ContextState> = ActionSpec<ContextState>,
  OriginalState extends ContextState = ContextState,
> = {
  defaultContentType: string;
  defaultHandler: ParameterizedMiddleware<
    State,
    Spec
  >;
  metadata: HandlerMetadata;
  contentTypes?: string[];
  // deno-lint-ignore no-explicit-any
  pre: PreAction<any, OriginalState>;
  post: PostAction<Term, Compatibility, State, Spec, OriginalState>;
};

export type DefineArgs<
  // deno-lint-ignore no-explicit-any
  Term extends string = any,
  Compatibility extends ActionCompatibility = ActionCompatibility,
  State extends ContextState = EmptyObject,
  Spec extends ActionSpec<State> = ActionSpec<State>,
> = Omit<PostActionArgs<Term, Compatibility, State, Spec>, 'pre'> & {
  compatiblity?: Compatibility;
};

export class PreAction<
  State extends ContextState = EmptyObject,
  OriginalState extends ContextState = State,
> implements Action<OriginalState> {
  #registry: ActionRegistry;
  #rootIRI: string;
  #name: string;
  #method: string;
  #urlPattern: URLPattern;
  #vocab?: string;
  #aliases?: Aliases;
  #extensionParam: string;
  #useFileExtensions: boolean;
  #extensions: Record<string, string>;
  #actionPathPrefix: string;
  #expose: boolean = true;
  #strict: boolean = true;
  #typeDef?: TypeDef;
  #middleware: Array<
    // deno-lint-ignore no-explicit-any
    | Middleware<any>
    // deno-lint-ignore no-explicit-any
    | ParameterizedMiddleware<any, any>
  > = [];
  #child?: 
    // deno-lint-ignore no-explicit-any
    | PostAction<any, any, any, any, OriginalState>
    // deno-lint-ignore no-explicit-any
    | TypedAction<any, any, any, any, OriginalState>
  ;

  constructor(args: PreActionArgs) {
    this.#registry = args.registry;
    this.#rootIRI = args.rootIRI;
    this.#name = args.name;
    this.#method = args.method.toUpperCase();
    this.#vocab = args.vocab;
    this.#aliases = args.aliases;
    this.#actionPathPrefix = args.actionPathPrefix;
    this.#extensionParam = args.extensionsParam || 'ext';
    this.#useFileExtensions = args.useFileExtensions || false;
    this.#extensions = args.extensions || FileExtension;
    this.#urlPattern = args.urlPattern;

    // @TODO Support extensions on api root
    if (this.#useFileExtensions && args.urlPattern.pathname !== '/') {
      this.#urlPattern = new URLPattern({
        ...args.urlPattern,
        pathname:
          `${args.urlPattern.pathname}:${this.#extensionParam}(\\.[a-z]+)?`,
      });
    }
  }

  get registry(): ActionRegistry {
    return this.#registry;
  }

  get child(): PostAction | TypedAction | undefined {
    return this.#child;
  }

  get rootIRI(): string {
    return this.#rootIRI;
  }

  get actionIRI(): string {
    return joinPaths(this.#rootIRI, this.actionPathPrefix, this.#name);
  }

  get name(): string {
    return this.#name;
  }

  get method(): string {
    return this.#method;
  }

  get urlPattern(): URLPattern {
    return this.#urlPattern;
  }

  get actionPathPrefix(): string {
    return this.#actionPathPrefix;
  }

  get expose(): boolean {
    return this.#expose;
  }

  get strict(): boolean {
    return this.#strict;
  }

  get term(): string | undefined {
    return this.#typeDef?.term;
  }

  get type(): string | undefined {
    return this.#typeDef?.type;
  }

  get typeDef(): TypeDef | undefined {
    return this.#typeDef;
  }

  get context(): JSONLDContext | undefined {
    if (this.#child) {
      return this.#child.context;
    }

    return undefined;
  }

  public describeHandlers(): HandlerDescription[] {
    if (this.#child != null) {
      return this.#child.describeHandlers();
    }

    return [];
  }

  public partial(): JSONObject | undefined {
    if (!this.#child) {
      return undefined;
    }

    return this.#child.partial();
  }

  public body(): Promise<JSONObject | undefined> {
    if (!this.#child) {
      return Promise.resolve(undefined);
    }

    return this.#child.body();
  }

  get contentTypes(): string[] {
    if (this.child) {
      return this.child.contentTypes;
    }

    return [];
  }

  get middleware(): ReadonlyArray<Middleware | ParameterizedMiddleware> {
    return [...this.#middleware];
  }

  public use<
    const MiddlewareState extends ContextState = ContextState,
  >(
    middleware: Middleware<MiddlewareState>,
  ): PreAction<
    Merge<MiddlewareState, State>,
    OriginalState
  > {
    this.#middleware.push(middleware);

    return this as unknown as PreAction<
      Merge<MiddlewareState, State>,
      OriginalState
    >;
  }

  public define<
    // deno-lint-ignore no-explicit-any
    const Term extends string = any,
    const Compatibility extends ActionCompatibility = ActionCompatibility,
    const Spec extends ActionSpec<ContextState> = ActionSpec<ContextState>,
    const MergedState extends ContextState = Merge<State,EmptyObject>,
  >(args: DefineArgs<Term, Compatibility, State, Spec> = {}): PostAction<
    Term,
    Compatibility,
    MergedState,
    Spec,
    OriginalState
  > {
    this.#expose = args.expose || true;
    this.#strict = args.strict || true;
    this.#vocab = args.vocab || this.#vocab;
    this.#aliases = args.aliases || this.#aliases;
    this.#typeDef = args.typeDef;

    const middleware: ParameterizedMiddleware<
      State,
      Spec
    > = async (
      ctx: ParameterizedContext<
        State,
        Spec
      >,
      next,
    ) => {
      if (this.#child) {
        const { params, query, payload } = await processAction<
          Term,
          Compatibility,
          State,
          Spec,
          OriginalState
        >({
          iri: ctx.iri,
          req: ctx.req,
          state: ctx.state,
          action: this.#child,
        });

        ctx.params = params;
        ctx.query = query;
        ctx.payload = payload as ActionPayload<Spec>;

        await next();
      }
    };

    this.#middleware.push(middleware);

    const postAction = new PostAction<
      Term,
      Compatibility,
      MergedState,
      Spec,
      OriginalState
    >({
      ...args,
      vocab: this.#vocab,
      aliases: this.#aliases,
      pre: this,
    });

    this.#child = postAction;

    return postAction;
  }

  public handle(
    defaultHandler: Middleware<State>,
    // deno-lint-ignore no-explicit-any
  ): TypedAction<any, any, State, EmptyObject, OriginalState>;

  public handle(
    defaultContentType: string | string[],
    defaultHandler: Middleware<State>,
    // deno-lint-ignore no-explicit-any
  ): TypedAction<any, any, State, EmptyObject, OriginalState>;

  public handle(
    handleArgs: HandleArgs<State>,
    // deno-lint-ignore no-explicit-any
  ): TypedAction<any, any, State, EmptyObject, OriginalState>;

  public handle(
    arg1: string | string[] | Middleware<State> | HandleArgs<State>,
    arg2?: Middleware<State>,
  ): TypedAction<
    string,
    ActionCompatibility,
    State,
    EmptyObject,
    OriginalState
  > {
    let defaultContentType = '*/*';
    let defaultHandler: Middleware<State> | undefined;
    let contentTypes: string[] | undefined;
    const metadata: HandlerMetadata = {};

    if (typeof arg1 === 'string') {
      defaultContentType = arg1;
    } else if (Array.isArray(arg1)) {
      [defaultContentType, ...contentTypes] = arg1;
    }

    if (typeof arg1 === 'function') {
      defaultHandler = arg1;
    } else if (typeof arg2 === 'function') {
      defaultHandler = arg2;
    }

    if (isObject(arg1) && typeof arg1.contentType === 'string') {
      defaultHandler = arg1.handler;
      defaultContentType = arg1.contentType;
      
      if (arg1.metadata != null) {
        metadata[arg1.contentType] = arg1.metadata;
      }
    } else if (isObject(arg1) && Array.isArray(arg1.contentType)) {
      defaultHandler = arg1.handler;
      [defaultContentType, ...contentTypes] = arg1.contentType;
     
      if (arg1.metadata != null) {
        for (const contentType of arg1.contentType) {
          metadata[contentType] = arg1.metadata;
        }
      }
    }

    if (typeof defaultHandler !== 'function') {
      throw new Error(`Action ${this.name} handler incorrectly configured.`);
    }

    const post = new PostAction<
      string,
      ActionCompatibility,
      State,
      EmptyObject,
      OriginalState
    >({
      pre: this,
      expose: false,
    });

    const typed = new TypedAction<
      string,
      ActionCompatibility,
      State,
      EmptyObject,
      OriginalState
    >({
      defaultContentType,
      defaultHandler,
      metadata,
      contentTypes,
      pre: this,
      post,
    });

    post.child = typed;
    
    this.#child = post;

    return typed;
  }

  public getNextFn(ctx: Context<OriginalState>): NextFn {
    const post = this.child as PostAction;
    const typed = post?.child;

    let next: NextFn = async () => {};

    if (typed) {
      let handled: boolean = false;

      for (const [contentTypes, handler] of typed.handlers) {
        if (contentTypes.includes(ctx.contentType)) {
          handled = true;

          const upstream = next;

          next = async () => {
            await handler(ctx as ParameterizedContext<OriginalState>, upstream);

            ctx.headers.set('content-type', ctx.contentType);
          };

          break;
        }
      }

      if (!handled) {
        ctx.status = STATUS_CODE.UnsupportedMediaType;
      }
    }

    if (post) {
      for (const middleware of post.middleware.toReversed()) {
        const upstream = next;

        next = async () => {
          await middleware(ctx as unknown as ParameterizedContext, upstream);
        };
      }
    }

    for (const middleware of this.middleware.toReversed()) {
      const upstream = next;

      next = async () => {
        await middleware(ctx as ParameterizedContext<OriginalState>, upstream);
      };
    }

    return next;
  }

  public accepts(ctx: Context<OriginalState>): string | undefined {
    if (ctx.req.method !== this.#method.toUpperCase()) {
      return;
    }

    const result = this.#urlPattern.exec(ctx.iri);

    if (!result) {
      return;
    }

    if (this.#useFileExtensions) {
      const extension = result.pathname.groups[this.#extensionParam]?.replace(
        '.',
        '',
      );
      const contentType = this.#extensions[extension || ''];

      if (this.contentTypes.includes(contentType)) {
        return contentType;
      } else if (extension) {
        return;
      }
    }

    return accepts(ctx.req, ...this.contentTypes);
  }

  public async handleRequest(
    req: Request,
    state: OriginalState,
  ): Promise<Response> {
    const iri = urlToIRI(req.url, this.rootIRI);
    const ctx: Context<OriginalState> = {
      iri,
      method: req.method as ActionHTTPMethod,
      req,
      state,
      registry: this.#registry,
      contentType: '',
      headers: new Headers(),
      bodySerialized: false,
    };

    const contentType = this.accepts(ctx);

    if (typeof contentType !== 'string') {
      return new Response(null, {
        status: STATUS_CODE.UnsupportedMediaType,
      });
    }

    ctx.contentType = contentType;

    await this.handleContext(ctx);

    return makeResponse(ctx);
  }

  public async handleContext(ctx: Context<OriginalState>): Promise<void> {
    const post = this.child as PostAction;
    const typed = post?.child;

    let next: NextFn = async () => {};

    if (typed) {
      let handled: boolean = false;
      for (const [contentTypes, handler] of typed.handlers) {
        if (contentTypes.includes(ctx.contentType)) {
          handled = true;

          const upstream = next;

          next = async () => {
            try {
              await handler(ctx as ParameterizedContext<OriginalState>, upstream);

              if (typeof ctx.status !== 'number') {
                ctx.status = STATUS_CODE.OK;
              }

              ctx.headers.set('content-type', ctx.contentType);
            } catch (err) {
              console.log(err);
              throw err;
            }
          };

          break;
        }
      }

      if (!handled) {
        ctx.status = STATUS_CODE.UnsupportedMediaType;
      }
    }

    if (post) {
      for (const middleware of post.middleware.toReversed()) {
        const upstream = next;

        next = async () => {
          await middleware(ctx as ParameterizedContext<OriginalState>, upstream);
        };
      }
    }

    for (const middleware of this.middleware.toReversed()) {
      const upstream = next;

      next = async () => {
        await middleware(ctx as ParameterizedContext<OriginalState>, upstream);
      };
    }

    await next();
  }
}

export class PostAction<
  // deno-lint-ignore no-explicit-any
  Term extends string = any,
  Compatibility extends ActionCompatibility = ActionCompatibility,
  State extends ContextState = ContextState,
  Spec extends ActionSpec<ContextState> = ActionSpec<ContextState>,
  OriginalState extends ContextState = ContextState,
> implements Action {
  #parent: PreAction<State, OriginalState>;
  // deno-lint-ignore no-explicit-any
  #child?: TypedAction<Term, Compatibility, any, Spec, OriginalState>;
  #vocab?: string;
  #aliases?: Aliases;
  #spec: Spec;

  #middleware: Array<
    ParameterizedMiddleware<
      // deno-lint-ignore no-explicit-any
      any,
      Spec
    >
  > = [];

  constructor(args: PostActionArgs<Term, Compatibility, State, Spec>) {
    this.#parent = args.pre;
    this.#vocab = args.vocab;
    this.#aliases = args.aliases;
    this.#spec = args.spec || ({} as Spec);
  }

  get registry(): ActionRegistry {
    return this.#parent.registry;
  }
  
  get parent(): PreAction<
    State,
    OriginalState
  > {
    return this.#parent;
  }

  get child(): TypedAction<Term, Compatibility, State, Spec, OriginalState> | undefined {
    return this.#child;
  }

  set child(child: TypedAction<Term, Compatibility, State, Spec, OriginalState>) {
    this.#child = child;
  }

  get rootIRI(): string {
    return this.#parent.rootIRI;
  }

  get actionIRI(): string {
    return this.#parent.actionIRI;
  }

  get name(): string {
    return this.#parent.name;
  }

  get method(): string {
    return this.#parent.method;
  }

  get urlPattern(): URLPattern {
    return this.#parent.urlPattern;
  }

  get expose(): boolean {
    return this.#parent.expose;
  }

  get strict(): boolean {
    return this.#parent.strict;
  }

  get term(): string | undefined {
    return this.#parent.term;
  }

  get type(): string | undefined {
    return this.#parent.type;
  }

  get typeDef(): TypeDef | undefined {
    return this.#parent.typeDef;
  }

  get actionPathPrefix(): string {
    return this.#parent.actionPathPrefix;
  }

  get spec(): Readonly<Spec> {
    return this.#spec;
  }

  get contentTypes(): string[] {
    if (this.child) {
      return this.child.contentTypes;
    }

    return [];
  }

  get middleware(): Array<ParameterizedMiddleware<State, Spec>> {
    return [...this.#middleware];
  }

  get context(): JSONLDContext {
    return getActionContext({
      spec: this.#spec,
      vocab: this.#vocab,
      aliases: this.#aliases,
    });
  }

  get urlTemplate(): string {
    const pathname = this.urlPattern.pathname;
    const regexp = /\:([^\/|?]+)/g;
    const queryValues: string[] = [];
    const paramValues: string[] = [];
    const keyNames: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = regexp.exec(pathname)) !== null) {
      if (match != null) {
        keyNames?.push(match[1]);
      }
    }

    for (const spec of Object.values(this.#spec)) {
      if (typeof spec.valueName === 'string') {
        const index = keyNames.findIndex((valueName) =>
          valueName === spec.valueName
        );

        if (index !== -1) {
          paramValues[index] = spec.valueName;
        } else {
          queryValues.push(spec.valueName);
        }
      }
    }

    let urlTemplate = this.urlPattern.pathname;

    for (let index = 0; index < keyNames.length; index++) {
      const keyName = keyNames[index];
      const valueName = paramValues[index];

      if (valueName == null) {
        throw new Error(
          `The action ${this.name} must have a top level spec item having a matching value name for the url parameter ${keyName}`,
        );
      }

      urlTemplate = urlTemplate.replace(`\:${keyName}`, `{${valueName}}`);
    }

    if (queryValues.length > 0) {
      urlTemplate = `${urlTemplate}{?${queryValues.join(',')}}`;
    }

    return joinPaths(this.rootIRI, urlTemplate);
  }

  public describeHandlers(): HandlerDescription[] {
    if (this.#child != null) {
      return this.#child.describeHandlers();
    }

    return [];
  }

  public partial(): JSONObject {
    return {
      '@id': joinPaths(this.rootIRI, this.actionPathPrefix, this.name),
      '@type': this.term,
    };
  }

  public async body(): Promise<JSONObject> {
    const apiSpec = await getPropertyValueSpecifications(this.#spec);

    return {
      '@context': this.context,
      '@id': joinPaths(this.rootIRI, this.actionPathPrefix, this.name),
      '@type': this.term,
      target: {
        '@type': 'https://schema.org/EntryPoint',
        httpMethod: this.method,
        urlTemplate: this.urlTemplate,
        contentType: ContentType.ApplicationJSONLD,
      },
      ...apiSpec,
    };
  }

  public use<
    const MiddlewareState extends ContextState = ContextState,
  >(
    middleware: ParameterizedMiddleware<
      MiddlewareState,
      Spec
    >,
  ): PostAction<
    Term,
    Compatibility,
    Merge<MiddlewareState, State>,
    Spec,
    OriginalState
  > {
    this.#middleware.push(middleware);

    return this as unknown as PostAction<
      Term,
      Compatibility,
      Merge<MiddlewareState, State>,
      Spec,
      OriginalState
    >;
  }

  public handle(
    defaultHandler: ParameterizedMiddleware<
      State,
      Spec
    >,
  ): TypedAction<Term, Compatibility, State, Spec, OriginalState>;

  public handle(
    defaultContentType: string | string[],
    defaultHandler: ParameterizedMiddleware<
      State,
      Spec
    >,
  ): TypedAction<Term, Compatibility, State, Spec, OriginalState>;

  public handle(
    handlerArgs: ParameterizedHandleArgs<State, Spec>,
  ): TypedAction<Term, Compatibility, State, Spec, OriginalState>;

  public handle(
    arg1:
      | string
      | string[]
      | ParameterizedMiddleware<State, Spec>
      | ParameterizedHandleArgs<State, Spec>,
    arg2?: ParameterizedMiddleware<State, Spec>,
  ): TypedAction<
    Term,
    Compatibility,
    State,
    Spec,
    OriginalState
  > {
    let defaultContentType = '*/*';
    let defaultHandler: ParameterizedMiddleware<State, Spec> | undefined;
    let contentTypes: string[] | undefined;
    const metadata: HandlerMetadata = {}

    if (typeof arg1 === 'string') {
      defaultContentType = arg1;
    } else if (Array.isArray(arg1)) {
      [defaultContentType, ...contentTypes] = arg1;
    }

    if (typeof arg1 === 'function') {
      defaultHandler = arg1;
    } else if (typeof arg2 === 'function') {
      defaultHandler = arg2;
    }

    if (isObject(arg1) && typeof arg1.contentType === 'string') {
      defaultHandler = arg1.handler;
      defaultContentType = arg1.contentType;

      if (arg1.metadata != null) {
        metadata[arg1.contentType] = arg1.metadata;
      }
    } else if (isObject(arg1) && Array.isArray(arg1.contentType)) {
      defaultHandler = arg1.handler;
      [defaultContentType, ...contentTypes] = arg1.contentType;

      if (arg1.metadata != null) {
        for (const contentType of arg1.contentType) {
          metadata[contentType] = arg1.metadata;
        }
      }
    }

    if (typeof defaultHandler !== 'function') {
      throw new Error(`Action ${this.name} handler incorrectly configured.`);
    }

    const typed = new TypedAction<
      Term,
      Compatibility,
      State,
      Spec,
      OriginalState
    >({
      defaultContentType,
      defaultHandler,
      contentTypes,
      metadata,
      pre: this.#parent,
      post: this,
    });

    this.#child = typed;

    return typed;
  }

  public accepts(ctx: Context<OriginalState>): string | undefined {
    return this.parent.accepts(ctx);
  }

  public handleRequest(req: Request, state: OriginalState): Promise<Response> {
    return this.parent.handleRequest(req, state);
  }

  public handleContext(ctx: Context<OriginalState>): Promise<void> {
    return this.parent.handleContext(ctx);
  }

  public getNextFn(ctx: Context<OriginalState>): NextFn {
    return this.#parent.getNextFn(ctx);
  }
}

export class TypedAction<
  // deno-lint-ignore no-explicit-any
  Term extends string = any,
  Compatibility extends ActionCompatibility = ActionCompatibility,
  State extends ContextState = ContextState,
  Spec extends ActionSpec<ContextState> = ActionSpec<ContextState>,
  OriginalState extends ContextState = ContextState,
> implements Action {
  #defaultContentType: string;
  #defaultHandler: ParameterizedMiddleware<
    State,
    Spec
  >;
  #handlers: Array<
    [string[], ParameterizedMiddleware<State, Spec>]
  > = [];
  #handlerMetadata: Map<string, HandlerMetadata> = new Map();
  #parent: PostAction<Term, Compatibility, State, Spec, OriginalState>;

  constructor(args: TypedActionArgs<Term, Compatibility, State, Spec>) {
    this.#defaultContentType = args.defaultContentType;
    this.#defaultHandler = args.defaultHandler;
    this.#parent = args.post;

    if (args.contentTypes) {
      this.#handlers.push([args.contentTypes, args.defaultHandler]);
    }

    for (const [contentType, metadata] of Object.entries(args.metadata)) {
      this.#handlerMetadata.set(contentType, metadata);
    }
  }

  get registry(): ActionRegistry {
    return this.#parent.registry;
  }

  get parent(): PostAction<
    Term,
    Compatibility,
    State,
    Spec,
    OriginalState
  > {
    return this.#parent;
  }

  get actionIRI(): string {
    return this.parent.actionIRI;
  }

  get rootIRI(): string {
    return this.parent.rootIRI;
  }

  get name(): string {
    return this.parent.name;
  }

  get method(): string {
    return this.parent.method;
  }

  get urlPattern(): URLPattern {
    return this.parent.urlPattern;
  }

  get expose(): boolean {
    return this.#parent.expose;
  }

  get strict(): boolean {
    return this.#parent.strict;
  }

  get actionPathPrefix(): string {
    return this.parent.actionPathPrefix;
  }

  get spec(): Spec {
    return this.parent.spec;
  }

  get contentTypes(): string[] {
    return [
      this.#defaultContentType,
      ...this.#handlers.flatMap(([contentTypes]) => contentTypes),
    ];
  }

  get middleware(): Array<ParameterizedMiddleware<State, Spec>> {
    return this.parent.middleware;
  }

  get handlers(): ReadonlyArray<[string[], ParameterizedMiddleware<State, Spec>]> {
    return [
      [[this.#defaultContentType], this.#defaultHandler],
      ...this.#handlers,
    ];
  }

  get context(): JSONLDContext {
    return this.#parent.context;
  }

  public partial(): JSONObject | undefined {
    return this.#parent.partial();
  }

  public body(): Promise<JSONObject | undefined> {
    return this.parent.body();
  }

  public describeHandlers(): HandlerDescription[] {
    const handlerDescriptions: HandlerDescription[] = [];

    for (const [contentType, metadata] of this.#handlerMetadata) {
      handlerDescriptions.push({
        contentType,
        metadata,
        action: this,
      });
    }

    return handlerDescriptions;
  }

  public handle(
    contentType: string | string[],
    middleware: Middleware<State>,
  ): TypedAction<Term, Compatibility, State, Spec, OriginalState>;

  public handle(
    handlerArgs: HandleArgs<State>,
  ): TypedAction<Term, Compatibility, State, Spec, OriginalState>;

  public handle(
    arg1:
      | string
      | string[]
      | HandleArgs<State>,
    arg2?: Middleware<State>,
  ): TypedAction<
      Term,
      Compatibility,
      State,
      Spec,
      OriginalState
    > {
    let defaultContentType = '*/*';
    let defaultHandler: Middleware<State> | undefined;
    let contentTypes: string[] = [];

    if (typeof arg1 === 'string') {
      defaultContentType = arg1;
    } else if (Array.isArray(arg1)) {
      [defaultContentType, ...contentTypes] = arg1;
    }

    if (typeof arg2 === 'function') {
      defaultHandler = arg2;
    }

    if (isObject(arg1) && typeof arg1.contentType === 'string') {
      defaultHandler = arg1.handler;
      defaultContentType = arg1.contentType;

      if (arg1.metadata != null) {
        this.#handlerMetadata.set(arg1.contentType, arg1.metadata);
      }
    } else if (isObject(arg1) && Array.isArray(arg1.contentType)) {
      defaultHandler = arg1.handler;
      [defaultContentType, ...contentTypes] = arg1.contentType;
      
      if (arg1.metadata != null) {
        for (const contentType of arg1.contentType) {
          this.#handlerMetadata.set(contentType, arg1.metadata);
        }
      }
    }

    if (typeof defaultHandler !== 'function') {
      throw new Error(`Action ${this.name} handler incorrectly configured.`);
    }

    this.#handlers.push([[defaultContentType, ...contentTypes], defaultHandler]);

    return this;
  }

  public getHandler(
    req: Request,
  ): { contentType: string; handler: ParameterizedMiddleware<State, Spec> } | undefined {
    const iri = urlToIRI(req.url, this.rootIRI);

    if (req.method !== this.method) {
      return;
    } else if (!this.urlPattern.test(iri)) {
      return;
    }

    const accept = accepts(req, ...this.contentTypes);

    if (accept == null || accept === this.#defaultContentType) {
      return {
        contentType: this.#defaultContentType,
        handler: this.#defaultHandler,
      };
    }

    for (const [contentTypes, handler] of this.#handlers) {
      if (contentTypes.includes(accept)) {
        return {
          contentType: accept,
          handler,
        };
      }
    }

    return;
  }

  public accepts(ctx: Context<OriginalState>): string | undefined {
    return this.parent.accepts(ctx);
  }

  public handleRequest(req: Request, state: OriginalState): Promise<Response> {
    return this.parent.handleRequest(req, state);
  }

  public handleContext(ctx: Context<OriginalState>): Promise<void> {
    return this.parent.handleContext(ctx);
  }

  public getNextFn(ctx: Context<OriginalState>): NextFn {
    return this.#parent.getNextFn(ctx);
  }
}

export type DefinedAction<
  // deno-lint-ignore no-explicit-any
  Term extends string = any,
  Compatibility extends ActionCompatibility = ActionCompatibility,
  State extends ContextState = ContextState,
  Spec extends ActionSpec<ContextState> = ActionSpec<ContextState>,
  OriginalState extends ContextState = ContextState,
> =
  | PostAction<Term, Compatibility, State, Spec, OriginalState>
  | TypedAction<Term, Compatibility, State, Spec, OriginalState>;
