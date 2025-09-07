import { Action } from '../types.ts';


export type CacheContext = {
  status: number;
  headers: Headers;
  authKey?: string;
  req: Request;
  bodyStream: ReadableStream;
  payload: any;
};

export type CacheStrategyType =
  | 'http'
  | 'etag'
  | 'store'
;

export type CacheArgs =
  | CacheHTTPArgs
  | CacheETagArgs
  | CacheStoreArgs
;

export interface CacheEntryDescriptor<
  Args extends CacheArgs = CacheArgs,
> {
  type: CacheStrategyType;
  action: Action;
  request: Request;
  args: Args;
};

export type CacheWhenFn = (
  ctx: CacheContext,
) => boolean;

export type CacheRuleArgs = {
  /**
   * Defaults to varying on the authorization header
   * when authenticated.
   */
  vary?: string;
  
  varyOnAuth?: boolean;

  varyOnCapabilities?: string | string[];

  /**
   * Defaults to false when a querystring is present
   * or the request is authenticated.
   */
  when?: 'always' | 'public' | 'authenticated' | 'noQuery' | CacheWhenFn;
};

export type CacheControlArgs = {
  private?: boolean;
  public?: true;
  noCache?: true;
  noStore?: true;
  mustRevalidate?: true;
  mustUndestand?: true;
  noTransform?: true;
  immutable?: true;
  proxyRevalidate?: true;
  expires?: () => number | Temporal;
  maxAge?: number | Temporal.Duration | (() => number | Temporal.Duration);
  etag?: string;
};

export type CacheHTTPArgs =
  & CacheRuleArgs
  & CacheControlArgs
;

export type CacheETagArgs =
  & CacheRuleArgs
  & Omit<CacheControlArgs, 'etag'>
;

export type CacheStoreArgs<
  StorageKey extends string = string,
> =
  & { storage?: StorageKey }
  & CacheRuleArgs
  & Omit<CacheControlArgs, 'etag'>
;

export type CacheDetails = {
  key: string;
  iri: string;
  status: number;
  hasContent: boolean;
  authKey: string;
  etag: string;
  header: ReadableStream;
  contentType: string;
  contentLength: number;
  contentEncoding: string;
  contentLanguage: string;
  contentRange: string;
};

export type CacheHitHandle =
  & CacheDetails
  & {
    type: 'cache-hit';
    set(details: CacheDetails): Promise<void>;
  };

export type CacheMissHandle = {
  type: 'cache-miss';
  set(details: CacheDetails): Promise<void>;
};

export type LockedCacheMissHandle = {
  type: 'locked-cache-miss';
  set(details: CacheDetails): Promise<void>;
  release(): Promise<void>;
};

export interface CacheMeta {
  get(key: string): Promise<CacheHitHandle | CacheMissHandle>;
  getOrLock(key: string): Promise<CacheHitHandle | LockedCacheMissHandle>;
}

export interface CacheStorage {
  /**
   * Retrieves a cache entry.
   */
  get(key: string): Promise<ReadableStream>;

  /**
   * Sets a cache entry.
   */
  set(key: string, data: ReadableStream): Promise<void>;
};

export type CacheSetter = (data: ReadableStream) => Promise<void>;

export interface ICacheGetter {
  get(descriptor: CacheEntryDescriptor): Promise<
    | CacheSetter
    | ReadableStream
  >;
}
