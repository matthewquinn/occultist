import { Action } from '../types.ts';


export type CacheStrategyType =
  | 'http'
  | 'etag'
  | 'store'
;

export interface CacheEntryDescriptor {
  type: CacheStrategyType;
  action: Action;
  request: Request;
  args:
    | CacheHTTPArgs
    | CacheETagArgs
    | CacheStoreArgs
};

export type CacheWhenFn = () => boolean;

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
  | CacheRuleArgs
  | CacheControlArgs
;

export type CacheETagArgs =
  | CacheRuleArgs
  | Omit<CacheControlArgs, 'etag'>
;

export type CacheStoreArgs<
  StorageKey extends string = string,
> =
  | { storage?: StorageKey }
  | CacheRuleArgs
  | Omit<CacheControlArgs, 'etag'>
;

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
