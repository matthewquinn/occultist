// deno-lint-ignore no-explicit-any
export function isPopulatedString(value: any): value is string {
  return typeof value === 'string' && value.length !== 0;
}
