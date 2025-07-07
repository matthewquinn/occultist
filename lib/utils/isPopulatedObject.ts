import { isObject } from './isObject.ts';

// deno-lint-ignore no-explicit-any
export function isPopulatedObject<ChildType>(value: any): value is Record<string, ChildType> {
  return isObject(value) && Object.keys(value).length > 0;
}
