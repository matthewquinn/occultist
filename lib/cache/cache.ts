import { CacheHTTPArgs, CacheETagArgs, CacheStoreArgs, CacheEntryDescriptor, CacheSetter, CacheStorage } from './types.ts';


export class Cache<
  StorageKey extends string = string,
> {
  #defaultStorage: CacheStorage;
  #alternatives?: Map<StorageKey, CacheStorage>;

  constructor(
    defaultStorage: CacheStorage,
    alternatives?: Record<StorageKey, CacheStorage>,
  ) {
    this.#defaultStorage = defaultStorage;

    if (alternatives != null) {
      this.#alternatives = new Map(
        Object.entries(alternatives) as Array<[StorageKey, CacheStorage]>
      );
    }
  }

  get(_descriptor: CacheEntryDescriptor): Promise<
    | CacheSetter
    | ReadableStream
  > {
    throw new Error('Cache.get() not implemented');
  }

  http(args: CacheHTTPArgs): CacheHTTPArgs & { cache: Cache } {
    return Object.assign(Object.create(null), args, { cache: this });
  }

  etag(args: CacheETagArgs): CacheETagArgs & { cache: Cache } {
    return Object.assign(Object.create(null), args, { cache: this });
  }

  store(args: CacheStoreArgs<StorageKey>): CacheStoreArgs<StorageKey> & { cache: Cache } {
    return Object.assign(Object.create(null), args, { cache: this });
  }
}

