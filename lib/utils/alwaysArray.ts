export function alwaysArray<T>(value: T | Array<T>): Array<T> {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== 'undefined' && value !== null) {
    return [value];
  }

  return [];
}
