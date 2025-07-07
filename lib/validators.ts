import {
  ArraySpec,
  FileInput,
  ObjectArraySpec,
  ObjectSpec,
  PropertySpec,
} from './types.ts';
import { isObject } from './utils/isObject.ts';
import { isGeneratorFunction, isGeneratorObject } from 'node:util/types';
import { preferredMediaTypes } from './utils/preferredMediaTypes.ts';
import { isNil } from "./utils/isNil.ts";
import { JSONValue } from "./jsonld.ts";


// deno-lint-ignore no-explicit-any
export function isFileData(value: any): value is FileInput {
  if (typeof value === 'string' && value.startsWith('data:')) {
    return true;
  } else if (isObject(value) && (isGeneratorFunction(value.iterable) || isGeneratorObject(value.iterable))) {
    return true;
  }

  return false;
}

export function isObjectArraySpec(spec: PropertySpec): spec is ObjectArraySpec {
  return isObject(spec.properties) && Boolean(spec.multipleValues);
}

export function isObjectSpec(spec: PropertySpec): spec is ObjectSpec {
  return isObject(spec.properties) && !spec.multipleValues;
}

export function isArraySpec(spec: PropertySpec): spec is ArraySpec {
  return !isObject(spec.properties) && Boolean(spec.multipleValues);
}

export function failsRequiredRequirement(
  value: JSONValue,
  specValue: PropertySpec,
) {
  return specValue.valueRequired && (typeof value === 'undefined' || value === null);
}

export function failsTypeRequirement(
  value: JSONValue | FileInput,
  specValue: PropertySpec,
) {
  if (isNil(specValue.dataType)) {
    return false;
  } else if (specValue.dataType === 'file' && isFileData(value)) {
    return false;
  }

  // deno-lint-ignore valid-typeof
  return typeof value !== specValue.dataType;
}


export function failsContentTypeRequirement(
  value: JSONValue | FileInput,
  specValue: PropertySpec
) {
  if (specValue.type !== 'file') {
    return false;
  } else if (!isFileData(value)) {
    return false;
  } else if (!specValue.contentType) {
    return false;
  }

  let contentType: string | null;

  if (typeof value === 'string') {
    contentType = value.replace(/^data\:/, '').split(';')[0];
  } else {
    contentType = value.type;
  }

  if (!contentType) {
    return true;
  } else if (typeof specValue.contentType === 'string') {
    return !preferredMediaTypes(contentType, [specValue.contentType]);
  }

  return !preferredMediaTypes(contentType, specValue.contentType);
}

export function failsMinValue(value: JSONValue, specValue: PropertySpec) {
  if (!specValue.valueRequired && isNil(value)) {
    return false;
  }

  if (typeof specValue.minValue !== 'number') {
    return false;
  } else if (typeof value !== 'number') {
    return true;
  }

  return value < specValue.minValue;
}

export function failsMaxValue(value: JSONValue, specValue: PropertySpec) {
  if (!specValue.valueRequired && isNil(value)) {
    return false;
  }

  if (typeof specValue.maxValue !== 'number') {
    return false;
  } else if (typeof value !== 'number') {
    return true;
  }

  return value > specValue.maxValue;
}

export function failsStepValue(value: JSONValue, specValue: PropertySpec) {
  if (typeof specValue.stepValue !== 'number') {
    return false;
  } else if (typeof value !== 'number') {
    return true;
  }

  return value % specValue.stepValue !== 0;
}

export function failsPatternValue(value: JSONValue, specValue: PropertySpec) {
  if (typeof specValue.valuePattern !== 'string') {
    return false;
  } else if (typeof value !== 'string') {
    return true;
  }

  const regexp = new RegExp(specValue.valuePattern);

  return !regexp.test(value);
}

export function failValueMinLength(value: JSONValue, specValue: PropertySpec) {
  if (typeof specValue.valueMinLength !== 'number') {
    return false;
  }

  if (typeof value === 'string' || Array.isArray(value)) {
    return value.length < specValue.valueMinLength;
  }

  return true;
}

export function failValueMaxLength(value: JSONValue, specValue: PropertySpec) {
  if (typeof specValue.valueMaxLength !== 'number') {
    return false;
  }

  if (typeof value === 'string' || Array.isArray(value)) {
    return value.length > specValue.valueMaxLength;
  }

  return true;
}

export function failsValidator(
  value: JSONValue | FileInput,
  specValue: PropertySpec,
) {
  if (typeof specValue.validator !== 'function') {
    return false;
  }

  const validator = specValue.validator as (
    value: JSONValue | FileInput,
  ) => boolean;

  return !validator(value);
}
