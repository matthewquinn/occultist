type ObjectValue = Record<string | number | symbol, unknown>;

export function isObject<T extends ObjectValue = ObjectValue>(
  // deno-lint-ignore no-explicit-any
  value: any,
): value is T {
  return typeof value === 'object' && value !== null;
}
