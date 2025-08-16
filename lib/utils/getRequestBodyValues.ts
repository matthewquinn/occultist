import { STATUS_CODE } from "@std/http/status";
import { type PostAction, type TypedAction, ContentType } from "../action.ts";
import { ProblemDetailsError } from "../errors.ts";
import type { JSONValue, ContextDefinition, JSONObject } from "../jsonld.ts";
import type { FileInput, ActionCompatibility, ContextState, ActionSpec, PropertySpec } from "../types.ts";
import { streamParts } from '@sv2dev/multipart-stream';
import jsonld from 'jsonld';


export type BodyValue = Record<string, FileInput | FileInput[] | JSONValue>;


export type RequestBodyResult = {
  bodyValues: BodyValue;
};

export async function getRequestBodyValues<
  // deno-lint-ignore no-explicit-any
  Term extends string = any,
  Compatibility extends ActionCompatibility = ActionCompatibility,
  State extends ContextState = ContextState,
  Spec extends ActionSpec<ContextState> = ActionSpec<ContextState>,
  OriginalState extends ContextState = ContextState,
>({
  req,
  action,
}: {
  req: Request,
  action:
    | PostAction<Term, Compatibility, State, Spec, OriginalState>
    | TypedAction<Term, Compatibility, State, Spec, OriginalState>;
}): Promise<RequestBodyResult> {
  let bodyValues: BodyValue = {};

  if (!['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase())) {
    return { bodyValues: {} };
  }

  const contentType = req.headers.get('content-type');
  const mappedTypes: Record<string, {
    term: string;
    propertySpec: PropertySpec;
  }> = Object.entries<PropertySpec>(action.spec)
    .reduce((acc, [term, propertySpec]) => {
      return {
        ...acc,
        [propertySpec.type || propertySpec.typeDef?.type]: {
          term,
          propertySpec,
        },
      };
    }, {});

  if (contentType?.startsWith(ContentType.MultipartFormData)) {
    // multipart should be sent using expanded types which get normalized
    // into the compact terms for each type.
    // otherwise json requests would need to also need to use
    // expanded terms.

    for await (const part of streamParts(req)) {
      if (typeof part.name !== 'string') {
        throw new ProblemDetailsError(STATUS_CODE.BadRequest, {
          title: 'Unnamed parameter in request multipart body',
        });
      }

      let term: string | undefined;
      let propertySpec: PropertySpec | undefined;

      if (part.type && !part.type.startsWith(ContentType.TextPlain)) {
        term = mappedTypes[part.name].term;
        propertySpec = mappedTypes[part.name].propertySpec;

        if (!term || !propertySpec) {
          continue;
        }

        if (propertySpec.dataType !== 'file') {
          throw new ProblemDetailsError(STATUS_CODE.BadRequest, {
            title: `Unexpected content '${part.name}' in request multipart body`,
          });
        }

        bodyValues[term] = part;
        continue;
      }

      if (part.type === ContentType.TextPlain || !part.type) {
        term = mappedTypes[part.name].term;
        propertySpec = mappedTypes[part.name].propertySpec;
      } else if (part.filename) {
        term = mappedTypes[part.name].term;
        propertySpec = mappedTypes[part.name].propertySpec;
      } else {
        throw new ProblemDetailsError(STATUS_CODE.BadRequest, {
          title: `Unexpected content '${part.name}' in request multipart body`,
        });
      }

      if (!term || !propertySpec) {
        continue;
      }

      const textValue = await part.text();

      if (!textValue) {
        continue;
      }

      if (propertySpec.dataType === 'number' && /\d+(\.\d+)?/.test(textValue)) {
        bodyValues[term] = Number(textValue);
      } else if (propertySpec.dataType === 'boolean') {
        bodyValues[term] = textValue === 'true';
      } else {
        bodyValues[term] = textValue;
      }
    }
  } else if (contentType?.startsWith(ContentType.ApplicationJSON)) {
    try {
      bodyValues = await req.json();
    } catch {
      throw new ProblemDetailsError(STATUS_CODE.BadRequest, {
        title: 'Failed to parse JSON body',
      });
    }
  } else if (contentType?.startsWith(ContentType.ApplicationJSONLD)) {
    let source: JSONValue;
    let expanded: jsonld.JsonLdDocument;
    let compacted: jsonld.NodeObject | undefined;

    try {
      source = await req.json();
    } catch {
      throw new ProblemDetailsError(STATUS_CODE.BadRequest, {
        title: 'Failed to parse JSON body',
      });
    }

    try {
      expanded = await jsonld.expand(source as jsonld.JsonLdDocument);
    } catch {
      throw new ProblemDetailsError(STATUS_CODE.BadRequest, {
        title: 'Failed to expand JSON-LD body',
      });
    }

    try {
      compacted = await jsonld.compact(expanded, action.context as ContextDefinition)
    } catch {
      throw new ProblemDetailsError(STATUS_CODE.BadRequest, {
        title: 'Failed to compact JSON-LD body',
      });
    }

    delete compacted['@context'];

    bodyValues = compacted as JSONObject;
  }

  return { bodyValues };
}
