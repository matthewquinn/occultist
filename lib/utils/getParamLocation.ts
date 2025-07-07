

export type ParamLocation =
  | 'path'
  | 'search'
;

export function getParamLocation(valueName: string, urlPattern: URLPattern): ParamLocation {
  if (urlPattern.pathname.includes(`:${valueName}`)) {
    return 'path';
  }

  return 'search';
}
