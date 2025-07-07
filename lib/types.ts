import type { JSONObject, JSONPrimitive, JSONValue, OrArray, RecursiveDigit, RecursiveIncrement, TypeDef } from "./jsonld.ts";
import type { DeepMerge } from './merge.ts';
import type { ActionRegistry } from "./registry.ts";


export type ActionHTTPMethod =
  | 'head'
  | 'get'
  | 'post'
  | 'put'
  | 'patch'
  | 'delete'
  | 'options';

export type EntryPoint = {
  contentType?: string;
  encodingType?: string;
  httpMethod?: Uppercase<ActionHTTPMethod>;
  urlTemplate: string;
};

export type Target = string | EntryPoint;

export type Merge<T1 extends object, T2 extends object> = DeepMerge<T1, T2>;

// deno-lint-ignore no-explicit-any
export type EmptyObject = Pick<{ [key: string]: any }, string>;

// deno-lint-ignore no-explicit-any
export type ContextState = Record<string, any>;

export type ActionCompatibility =
  | 'url-encoded'
  | 'form-data'
  | 'json';

export type ExtensionMap = Record<string, string>;

export enum BodyContentType {
  ApplicationJSON = 'application/json',
  ApplicationJSONLD = 'application/ld+json',
  MultipartFormData = 'multipart/form-data',
}

export interface FileData extends AsyncIterable<Uint8Array> {
  arrayBuffer(): Promise<ArrayBufferLike>;
  bytes(): Promise<Uint8Array>;
  size: number | null;
  type: string | null;
  name: string | null;
  filename: string | null;
}

export type FileInput = FileData | string;

export type RequestBody<
  Compatibility extends ActionCompatibility = ActionCompatibility,
> = Compatibility extends 'form-data' ? FormData
  : JSONObject;

export type ParsedIRIValues = Record<string, JSONPrimitive | JSONPrimitive[]>;

export interface Action<
  OriginalState extends ContextState = ContextState
> {
  readonly rootIRI: string;
  readonly name: string;
  readonly method: string;
  readonly urlPattern: URLPattern;
  readonly actionIRI: string;
  readonly expose: boolean;
  readonly strict: boolean;
  readonly term?: string;
  readonly type?: string;
  readonly typeDef?: TypeDef;
  readonly actionPathPrefix: string;
  readonly contentTypes: ReadonlyArray<string>;
  readonly spec?: ActionSpec;
  readonly context?: JSONObject | undefined;
  readonly bodyContentType?: ActionCompatibility;

  partial(): JSONObject | undefined;
  body(): Promise<JSONObject | undefined>;
  accepts(ctx: Context<OriginalState>): string | undefined;
  handleRequest(req: Request, state: OriginalState): Promise<Response>;
  handleContext(ctx: Context<OriginalState>): Promise<void>;
  getNextFn(ctx: Context<OriginalState>): NextFn;
}


export type Context<
  State extends ContextState = EmptyObject,
> = {
  method: ActionHTTPMethod;
  iri: string;
  req: Request;
  contentType: string;
  state: State;
  status?: number;
  bodySerialized: boolean;
  body?: string | Blob | BufferSource | ReadableStream | JSONValue;
  headers: Headers;
  // deno-lint-ignore no-explicit-any
  registry: ActionRegistry<any>;
  action?: Action;
};

export type ParameterizedContext<
  State extends ContextState = EmptyObject,
  Spec extends ActionSpec<State> = ActionSpec<State>,
> = Context<State> & {
  params: ParsedIRIValues;
  query: ParsedIRIValues;
  payload: ActionPayload<Spec>;
  action: Action;
};

export type NextFn =
  | (() => Promise<void>)
  | (() => void);

export type Middleware<
  // deno-lint-ignore no-explicit-any
  State extends Record<string, any> = Record<string, any>,
> = (ctx: Context<State>, next: NextFn) => void | Promise<void>;

export type ParameterizedMiddleware<
  State extends ContextState = EmptyObject,
  Spec extends ActionSpec<State> = ActionSpec<State>,
> = (
  ctx: ParameterizedContext<
    State,
    Spec
  >,
  next: NextFn,
) => void | Promise<void>;

export type ValueOption<Value extends JSONValue> = Value;

export type TextValueOption<Value extends JSONValue> = {
  text: string;
  value: Value;
};

export type ActionOption<Value extends JSONValue> =
  | ValueOption<Value>
  | TextValueOption<Value>;

export type ActionOptionsRetriever<Value extends JSONValue> =
  | (() => OrArray<ActionOption<Value>>)
  | (() => Promise<OrArray<ActionOption<Value>>>);

export type ActionOptions<Value extends JSONValue> =
  | OrArray<ActionOption<Value>>
  | ActionOptionsRetriever<Value>;

export type ValidatorFn<
  DataType extends JSONValue | FileInput,
  Value extends DataType,
> = (
  value: DataType,
) => value is Value;

export type TransformerFn<
  Value extends JSONValue | FileInput | FileInput[],
  // deno-lint-ignore no-explicit-any
  TransformTo extends any,
  ActionState extends ContextState = EmptyObject,
> = (value: Value, state: ActionState) => TransformTo | Promise<TransformTo>;

export type FileSingleSpec<
  Value extends FileInput = FileInput,
  // deno-lint-ignore no-explicit-any
  TransformTo extends any = any,
  ActionState extends ContextState = EmptyObject,
> = {
  dataType: 'file';
  multipleValues?: undefined;
  options?: undefined;
  contentType?: string | string[];
  validator?: ValidatorFn<FileInput, Value>;
  transformer?: TransformerFn<Value, TransformTo, ActionState>;
};

export type FileMultiSpec<
  Value extends FileInput = FileInput,
  // deno-lint-ignore no-explicit-any
  TransformTo extends any = any,
  ActionState extends ContextState = EmptyObject,
> = {
  dataType: 'file';
  multipleValues: true;
  options?: undefined;
  contentType?: string | string[];
  validator?: ValidatorFn<FileInput, Value>;
  transformer?: TransformerFn<Value[], TransformTo, ActionState>;
};

export type BooleanSingleSpec<
  Value extends boolean = boolean,
  // deno-lint-ignore no-explicit-any
  TransformTo extends any = any,
  ActionState extends ContextState = EmptyObject,
> = {
  dataType: 'boolean';
  options?: ActionOptions<Value>;
  multipleValues?: undefined;
  contentType?: undefined;
  validator?: ValidatorFn<boolean, Value>;
  transformer?: TransformerFn<Value, TransformTo, ActionState>;
};

export type BooleanMultiSpec<
  Value extends boolean = boolean,
  // deno-lint-ignore no-explicit-any
  TransformTo extends any = any,
  ActionState extends ContextState = EmptyObject,
> = {
  dataType: 'boolean';
  options?: ActionOptions<Value>;
  multipleValues: true;
  contentType?: undefined;
  validator?: ValidatorFn<boolean, Value>;
  transformer?: TransformerFn<Value[], TransformTo, ActionState>;
};

export type NumberSingleSpec<
  Value extends number = number,
  // deno-lint-ignore no-explicit-any
  TransformTo extends any = any,
  ActionState extends ContextState = EmptyObject,
> = {
  dataType: 'number';
  options?: ActionOptions<Value>;
  multipleValues?: undefined;
  contentType?: undefined;
  validator?: ValidatorFn<number, Value>;
  transformer?: TransformerFn<Value, TransformTo, ActionState>;
};

export type NumberMultiSpec<
  Value extends number = number,
  // deno-lint-ignore no-explicit-any
  TransformTo extends any = any,
  ActionState extends ContextState = EmptyObject,
> = {
  dataType: 'number';
  options?: ActionOptions<Value>;
  multipleValues: true;
  contentType?: undefined;
  validator?: ValidatorFn<number, Value>;
  transformer?: TransformerFn<Value[], TransformTo, ActionState>;
};

export type StringSingleSpec<
  Value extends string = string,
  // deno-lint-ignore no-explicit-any
  TransformTo extends any = any,
  ActionState extends ContextState = EmptyObject,
> = {
  dataType: 'string';
  options?: ActionOptions<Value>;
  multipleValues?: undefined;
  contentType?: undefined;
  validator?: ValidatorFn<string, Value>;
  transformer?: TransformerFn<Value, TransformTo, ActionState>;
};

export type StringMultiSpec<
  Value extends string = string,
  // deno-lint-ignore no-explicit-any
  TransformTo extends any = any,
  ActionState extends ContextState = EmptyObject,
> = {
  dataType: 'string';
  options?: ActionOptions<Value>;
  multipleValues: true;
  contentType?: undefined;
  validator?: ValidatorFn<string, Value>;
  transformer?: TransformerFn<Value[], TransformTo, ActionState>;
};

export type JSONValueSingleSpec<
  Value extends JSONValue = JSONValue,
  // deno-lint-ignore no-explicit-any
  TransformTo extends any = any,
  ActionState extends ContextState = EmptyObject,
> = {
  dataType?: undefined;
  options?: ActionOptions<Value>;
  multipleValues?: undefined;
  contentType?: undefined;
  validator?: ValidatorFn<JSONValue, Value>;
  transformer?: TransformerFn<Value, TransformTo, ActionState>;
};

export type JSONValueMultiSpec<
  Value extends JSONValue = JSONValue,
  // deno-lint-ignore no-explicit-any
  TransformTo extends any = any,
  ActionState extends ContextState = EmptyObject,
> = {
  dataType?: undefined;
  options?: ActionOptions<Value>;
  multipleValues: true;
  contentType?: undefined;
  validator?: ValidatorFn<JSONValue, Value>;
  transformer?: TransformerFn<Value[], TransformTo, ActionState>;
};

// export type URLEncodeSpec<
//   ActionState extends ContextState = EmptyObject,
// > =
//   // deno-lint-ignore no-explicit-any
//   | BooleanSingleSpec<boolean, any, ActionState>
//   // deno-lint-ignore no-explicit-any
//   | BooleanMultiSpec<boolean, any, ActionState>
//   // deno-lint-ignore no-explicit-any
//   | NumberSingleSpec<number, any, ActionState>
//   // deno-lint-ignore no-explicit-any
//   | NumberMultiSpec<number, any, ActionState>
//   // deno-lint-ignore no-explicit-any
//   | StringSingleSpec<string, any, ActionState>
//   // deno-lint-ignore no-explicit-any
//   | StringMultiSpec<string, any, ActionState>;

// export type FormDataSpec<
//   ActionState extends ContextState = EmptyObject,
// > =
//   // deno-lint-ignore no-explicit-any
//   | BooleanSingleSpec<boolean, any, ActionState>
//   // deno-lint-ignore no-explicit-any
//   | BooleanMultiSpec<boolean, any, ActionState>
//   // deno-lint-ignore no-explicit-any
//   | NumberSingleSpec<number, any, ActionState>
//   // deno-lint-ignore no-explicit-any
//   | NumberMultiSpec<number, any, ActionState>
//   // deno-lint-ignore no-explicit-any
//   | StringSingleSpec<string, any, ActionState>
//   // deno-lint-ignore no-explicit-any
//   | StringMultiSpec<string, any, ActionState>
//   // deno-lint-ignore no-explicit-any
//   | FileSingleSpec<FileData, any, ActionState>
//   // deno-lint-ignore no-explicit-any
//   | FileMultiSpec<FileData, any, ActionState>;

export type SpecOptions<
  ActionState extends ContextState = EmptyObject,
> =
  // deno-lint-ignore no-explicit-any
  | BooleanSingleSpec<boolean, any, ActionState>
  // deno-lint-ignore no-explicit-any
  | BooleanMultiSpec<boolean, any, ActionState>
  // deno-lint-ignore no-explicit-any
  | NumberSingleSpec<number, any, ActionState>
  // deno-lint-ignore no-explicit-any
  | NumberMultiSpec<number, any, ActionState>
  // deno-lint-ignore no-explicit-any
  | StringSingleSpec<string, any, ActionState>
  // deno-lint-ignore no-explicit-any
  | StringMultiSpec<string, any, ActionState>
  // deno-lint-ignore no-explicit-any
  | JSONValueSingleSpec<JSONValue, any, ActionState>
  // deno-lint-ignore no-explicit-any
  | JSONValueMultiSpec<JSONValue, any, ActionState>
  // deno-lint-ignore no-explicit-any
  | FileSingleSpec<FileInput, any, ActionState>
  // deno-lint-ignore no-explicit-any
  | FileMultiSpec<FileInput, any, ActionState>
;

export type BaseSpec<
  ActionState extends ContextState = EmptyObject,
  InternalTerm extends string = string,
  Compatibility extends ActionCompatibility = ActionCompatibility,
> =
  & {
    valueName?: string;
    internalTerm?: InternalTerm;
    readonlyValue?: boolean;
    defaultValue?: JSONValue;
    valueRequired?: boolean;
    minValue?: JSONPrimitive;
    maxValue?: JSONPrimitive;
    stepValue?: number;
    valuePattern?: string;
    validationMessage?: string;
    parseFailureMessage?: string;
    parseFailureStatus?: number;
  }
  & (
    | { typeDef: TypeDef; type?: undefined }
    | { type: string; typeDef?: undefined }
  )
  & SpecOptions<ActionState>;

export type ValueSpec<ActionState extends ContextState = EmptyObject> =
  & BaseSpec<ActionState>
  & {
    multipleValues?: false;
    valueMaxLength?: number;
    valueMinLength?: number;
    properties?: undefined;
  };

export type ArraySpec<ActionState extends ContextState = EmptyObject> =
  & BaseSpec<ActionState>
  & {
    multipleValues: true;
    valueMaxLength?: number;
    valueMinLength?: number;
    properties?: undefined;
  };

export type ObjectSpec<
  ActionState extends ContextState = ContextState,
  RecursionCount extends RecursiveDigit | 'STOP' = 7,
> = BaseSpec & {
  multipleValues?: false;
  valueMaxLength?: undefined;
  valueMinLength?: undefined;
  properties: {
    [term: string]: PropertySpec<
      ActionState,
      RecursiveIncrement<RecursionCount>
    >;
  };
};

export type ObjectArraySpec<
  ActionState extends ContextState = ContextState,
  RecursionCount extends RecursiveDigit | 'STOP' = 7,
> = BaseSpec & {
  multipleValues: true;
  valueMaxLength?: number;
  valueMinLength?: number;
  properties: {
    [term: string]: PropertySpec<
      ActionState,
      RecursiveIncrement<RecursionCount>
    >;
  };
};

/**
 * @todo Support ActionState typing the Transformed func
 */
export type PropertySpec<
  ActionState extends ContextState = EmptyObject,
  RecursionCount extends RecursiveDigit | 'STOP' = 7,
> =
  // RecursionCount extends 'STOP' ? (
  | ValueSpec<ActionState>
  | ArraySpec<ActionState>
  | ObjectSpec
  | ObjectArraySpec; // ) : (
//   | ValueSpec<ActionState>
//   | ArraySpec<ActionState>
//   | ObjectSpec<ActionState>
//   | ObjectArraySpec<ActionState>
// )

export type ActionSpec<ActionState extends ContextState = EmptyObject> = {
  [term: string]: PropertySpec<ActionState>;
};

export type PropertySpecResult<PropertySpecItem extends PropertySpec> =
  PropertySpecItem extends FileSingleSpec<
    infer Value,
    infer TransformTo,
    infer State
  > ? PropertySpecItem['transformer'] extends TransformerFn<
      Value,
      TransformTo,
      State
    > ? TransformTo
    : PropertySpecItem['validator'] extends ValidatorFn<FileInput, Value> ? Value
    : FileInput
    : PropertySpecItem extends FileMultiSpec<
      infer Value,
      infer TransformTo,
      infer State
    > ? PropertySpecItem['transformer'] extends TransformerFn<
        Value,
        TransformTo,
        State
      > ? TransformTo
      : PropertySpecItem['validator'] extends ValidatorFn<FileInput, Value> ? Value[]
      : FileInput[]
    : PropertySpecItem extends BooleanSingleSpec<
      infer Value,
      infer TransformTo,
      infer State
    > ? PropertySpecItem['transformer'] extends TransformerFn<
        Value,
        TransformTo,
        State
      > ? TransformTo
      : PropertySpecItem['validator'] extends ValidatorFn<boolean, Value>
        ? Value
      : boolean
    : PropertySpecItem extends BooleanMultiSpec<
      infer Value,
      infer TransformTo,
      infer State
    > ? PropertySpecItem['transformer'] extends TransformerFn<
        Value,
        TransformTo,
        State
      > ? TransformTo
      : PropertySpecItem['validator'] extends ValidatorFn<boolean, Value>
        ? Value[]
      : boolean[]
    : PropertySpecItem extends NumberSingleSpec<
      infer Value,
      infer TransformTo,
      infer State
    > ? PropertySpecItem['transformer'] extends TransformerFn<
        Value,
        TransformTo,
        State
      > ? TransformTo
      : PropertySpecItem['validator'] extends ValidatorFn<number, Value> ? Value
      : number
    : PropertySpecItem extends NumberMultiSpec<
      infer Value,
      infer TransformTo,
      infer State
    > ? PropertySpecItem['transformer'] extends TransformerFn<
        Value,
        TransformTo,
        State
      > ? TransformTo
      : PropertySpecItem['validator'] extends ValidatorFn<number, Value>
        ? Value[]
      : number[]
    : PropertySpecItem extends StringSingleSpec<
      infer Value,
      infer TransformTo,
      infer State
    > ? PropertySpecItem['transformer'] extends TransformerFn<
        Value,
        TransformTo,
        State
      > ? TransformTo
      : PropertySpecItem['validator'] extends ValidatorFn<string, Value> ? Value
      : string
    : PropertySpecItem extends StringMultiSpec<
      infer Value,
      infer TransformTo,
      infer State
    > ? PropertySpecItem['transformer'] extends TransformerFn<
        Value,
        TransformTo,
        State
      > ? TransformTo
      : PropertySpecItem['validator'] extends ValidatorFn<
        string,
        Value
      > ? Value[]
      : string[]
    : PropertySpecItem extends JSONValueSingleSpec<
      infer Value,
      infer TransformTo,
      infer _State
    > ? PropertySpecItem['transformer'] extends TransformerFn<
        Value,
        TransformTo
      > ? TransformTo
      : PropertySpecItem['validator'] extends ValidatorFn<
        JSONValue,
        Value
      > ? Value
      : JSONValue
    : PropertySpecItem extends JSONValueMultiSpec<
      infer Value,
      infer TransformTo,
      infer _State
    > ? PropertySpecItem['transformer'] extends TransformerFn<
        Value,
        TransformTo
      > ? TransformTo
      : PropertySpecItem['validator'] extends ValidatorFn<
        JSONValue,
        Value
      > ? Value[]
      : JSONValue[]
    : JSONValue;

export type ActionPayload<
  // deno-lint-ignore no-explicit-any
  Spec extends ActionSpec<any> = ActionSpec<any>,
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

export type ResponseInputSpec = {
  '@type': 'https://schema.org/PropertyValueSpecification';
  readonlyValue?: boolean;
  defaultValue?: JSONValue;
  minValue?: JSONPrimitive;
  maxValue?: JSONPrimitive;
  stepValue?: number;
  valueName?: string;
  valuePatern?: string;
  valueRequired?: boolean;
  multipleValues?: boolean;
  valueMaxLength?: number;
  valueMinLength?: number;
};

export type SpecValue = {
  [key: string]: SpecValue | ActionOptions<JSONValue> | ResponseInputSpec;
};

export type ProblemDetailsParam = {
  name: string;
  reason: string;
  pointer?: string;
};

export type ProblemDetails = {
  title: string;
  type?: string;
  detail?: string;
  instance?: string;
  errors?: Array<ProblemDetailsParam>;
};
