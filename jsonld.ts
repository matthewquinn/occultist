// https://w3c.github.io/json-ld-syntax/#syntax-tokens-and-keywords

export type ContextVersion = 1.1;
export type ContextDefinitionType = '@id';
export type ContextDefinitionContainer =
  | '@list'
  | '@set';

export type ContextDefinition = {
  '@id'?: string;
  '@type'?: ContextDefinitionType;
  '@container'?: ContextDefinitionContainer;
  '@context'?: Context;
  '@protected'?: boolean;
};

export type Context = {
  '@version'?: ContextVersion;
  '@base'?: string;
  '@protected'?: boolean;
  '@vocab'?: string;
} & Record<string, string | ContextDefinition>;

// deno-lint-ignore no-explicit-any
export type TypeDef<Term extends string = any, Type extends string = any> = {
  type: Type;
  term: Term;
  contextDefinition?: ContextDefinition;
};
