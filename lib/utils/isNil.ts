// deno-lint-ignore no-explicit-any
export function isNil(value: any): value is null | undefined {
  return typeof value === 'undefined' || value === null;
}
