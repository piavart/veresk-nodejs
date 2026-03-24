import {
  ConfigureError,
  FetchFileError,
  ManifestNotFoundError,
} from './errors';
import { EventEmitter } from 'events';
import {
  TVereskOptions,
  ILog,
  TUpdateFileEventData,
  TEmittedVereskError,
  TManifestFetchedEventData,
} from './interfaces';
import { FilesPackageFactory } from './settings/files-package.factory';
import { IFilesPackage } from './settings/types/files-package.interface';
import { EventName, FETCH_TIMEOUT_MS } from './constants';
import { findInCollection, filterCollection } from './utils/matchers';

export interface Veresk {
  on(
    event: typeof EventName.FileUpdated,
    listener: (data: TUpdateFileEventData) => void,
  ): this;
  on(
    event: typeof EventName.Error,
    listener: (error: TEmittedVereskError) => void,
  ): this;
  on(
    event: typeof EventName.ManifestFetched,
    listener: (data: TManifestFetchedEventData) => void,
  ): this;
}

type TCollectionFilter<T> = Partial<T>;
type TCollectionMatcher<T> = TCollectionFilter<T> | ((item: T) => boolean);
type TListItem<T extends unknown[]> = T[number];
type TListOptions<T extends unknown[]> = {
  consumer?: string;
  filter?: TCollectionFilter<TListItem<T>>;
  find?: TCollectionMatcher<TListItem<T>>;
};

export class Veresk extends EventEmitter {
  protected readonly expireMs: number;
  public readonly cdnUrls: string[];
  protected readonly fetchRetryCount: number;
  protected readonly fetchTimeout: number;
  protected readonly encryptSecret: string;

  readonly version: string;
  protected readonly consumer: string;

  protected reloadManifestInterval?: NodeJS.Timeout;
  protected readonly log: ILog;

  protected readonly filesPackageFactory: FilesPackageFactory;
  protected readonly filesPackages = new Map<string, IFilesPackage>();

  constructor(options: TVereskOptions) {
    super();
    if (!options.cdnUrls) {
      throw new ConfigureError('cdnUrls');
    }

    if (!options.version) {
      throw new ConfigureError('version');
    }

    if (!options.consumer) {
      throw new ConfigureError('consumer');
    }

    this.consumer = options.consumer;
    this.expireMs = options.expireMs || 60000;
    this.fetchRetryCount = options.fetchRetryCount || 0;
    this.fetchTimeout = options.fetchTimeout || FETCH_TIMEOUT_MS;
    this.version = options.version;
    this.cdnUrls = options.cdnUrls.map((url) => url.replace(/\/+$/, ''));
    this.encryptSecret = options.encryptSecret || '';
    this.log = options.log || console;

    this.filesPackageFactory = new FilesPackageFactory(this.consumer);
    this.set(this.consumer);

    this.log.log(
      `Veresk initialized: expireMs: ${
        this.expireMs
      } cdnUrls: ${this.cdnUrls.join(' ,')} version: ${
        this.version
      } consumer: ${this.consumer}`,
      `(${this.constructor.name})`,
    );
  }

  async init() {
    await this.update();
    this.reloadManifestInterval = setInterval(async () => {
      await this.update();
    }, this.expireMs);
  }

  protected async update() {
    try {
      const promises: Promise<void>[] = [];
      for (const filesPackage of this.filesPackages.values()) {
        promises.push(filesPackage.update());
      }
      await Promise.all(promises);
    } catch (err: unknown) {
      this.log.error(err, `(${this.constructor.name})`);

      if (
        err instanceof ManifestNotFoundError ||
        err instanceof FetchFileError
      ) {
        this.emit(EventName.Error, err);
      }
    }
  }

  public reset() {
    if (this.reloadManifestInterval) {
      clearInterval(this.reloadManifestInterval);
    }
    this.removeAllListeners();
    for (const filesPackage of this.filesPackages.values()) {
      filesPackage.reset();
    }
    this.filesPackages.clear();
  }

  async fetchManifest(consumer: string) {
    await this.loadIfNeed(consumer);
    return this.getManifest(consumer);
  }

  getManifest(consumer: string) {
    const filesPackage = this.get(consumer);

    return {
      etag: filesPackage.manifest.etag,
      manifest: filesPackage.manifest.data,
      contentUrls: filesPackage.contentUrls,
    };
  }

  async fetchContent<T = any>(
    name: string,
    options?: {
      consumer?: string;
      filter?: undefined;
      find?: undefined;
    },
  ): Promise<T>;
  async fetchContent<T = any>(
    name: string,
    options: {
      consumer?: string;
      filter?: TCollectionFilter<T>;
      find: TCollectionMatcher<T>;
    },
  ): Promise<T>;
  async fetchContent<T = any>(
    name: string,
    options: {
      consumer?: string;
      filter: TCollectionFilter<T>;
      find?: undefined;
    },
  ): Promise<T[]>;
  async fetchContent<T = any>(
    name: string,
    options: {
      consumer?: string;
      filter?: TCollectionFilter<T>;
      find?: TCollectionMatcher<T>;
    } = {},
  ) {
    const { consumer = this.consumer, filter, find } = options;

    await this.loadIfNeed(consumer);
    const listOptions = {
      consumer,
      filter,
      find,
    } as TListOptions<T[]>;

    if (find) {
      return this.getAsListOrThrowInternal<T[]>(name, listOptions);
    }

    if (filter) {
      return this.getAsListInternal<T[]>(name, listOptions);
    }

    return this.getContent<T>(name, consumer);
  }

  public getAsList<T extends unknown[]>(
    name: string,
    options?: {
      consumer?: string;
      filter?: undefined;
      find?: undefined;
    },
  ): T;
  public getAsList<T extends unknown[]>(
    name: string,
    options: {
      consumer?: string;
      filter: TCollectionFilter<TListItem<T>>;
      find?: undefined;
    },
  ): T;
  public getAsList<T extends unknown[]>(
    name: string,
    options: {
      consumer?: string;
      filter?: TCollectionFilter<TListItem<T>>;
      find: TCollectionMatcher<TListItem<T>>;
    },
  ): TListItem<T> | undefined;
  public getAsList<T extends unknown[]>(
    name: string,
    options: TListOptions<T> = {},
  ): T | TListItem<T> | undefined {
    return this.getAsListInternal(name, options);
  }

  public getAsListOrThrow<T extends unknown[]>(
    name: string,
    options?: {
      consumer?: string;
      filter?: undefined;
      find?: undefined;
    },
  ): T;
  public getAsListOrThrow<T extends unknown[]>(
    name: string,
    options: {
      consumer?: string;
      filter: TCollectionFilter<TListItem<T>>;
      find?: undefined;
    },
  ): T;
  public getAsListOrThrow<T extends unknown[]>(
    name: string,
    options: {
      consumer?: string;
      filter?: TCollectionFilter<TListItem<T>>;
      find: TCollectionMatcher<TListItem<T>>;
    },
  ): TListItem<T>;
  public getAsListOrThrow<T extends unknown[]>(
    name: string,
    options: TListOptions<T> = {},
  ): T | TListItem<T> {
    return this.getAsListOrThrowInternal(name, options);
  }

  public getContent<T = any>(name: string, consumer = this.consumer): T {
    const filesPackage = this.get(consumer);
    return filesPackage.get(name).data;
  }

  private getFile<T = any>(name: string, consumer = this.consumer) {
    const filesPackage = this.get(consumer);
    return filesPackage.get<T>(name);
  }

  private getAsListInternal<T extends unknown[]>(
    name: string,
    options: TListOptions<T> = {},
  ): T | TListItem<T> | undefined {
    const data = this.getListContent<T>(name, options.consumer);
    const filtered = options.filter
      ? filterCollection(data, options.filter)
      : data;

    if (options.find) {
      return findInCollection(filtered, options.find);
    }

    return filtered as T;
  }

  private getAsListOrThrowInternal<T extends unknown[]>(
    name: string,
    options: TListOptions<T> = {},
  ): T | TListItem<T> {
    const result = this.getAsListInternal(name, options);

    if (options.find && result === undefined) {
      throw new Error(
        `(Veresk) could not find item in "${name}" with matcher ${this.stringifyMatcher(
          options.find,
        )}`,
      );
    }

    return result as T | TListItem<T>;
  }

  private getListContent<T extends unknown[]>(
    name: string,
    consumer = this.consumer,
  ): T {
    const file = this.getFile<T>(name, consumer);

    if (!Array.isArray(file.data)) {
      throw new Error(`(Veresk) invalid file content. Must be a list.`);
    }

    return file.data as T;
  }

  private async loadIfNeed(consumer: string) {
    if (this.has(consumer)) {
      return;
    }

    const filesPackage = this.create(consumer);
    await filesPackage.update();

    this.filesPackages.set(this.key(this.version, consumer), filesPackage);
  }

  protected has(consumer: string) {
    return this.filesPackages.has(this.key(this.version, consumer));
  }

  protected get(consumer: string) {
    const filesPackage = this.filesPackages.get(
      this.key(this.version, consumer),
    );

    if (!filesPackage) {
      throw new Error(`could not find file for ${this.version}, ${consumer}`);
    }

    return filesPackage;
  }

  protected set(consumer: string) {
    const filesPackage = this.create(consumer);

    this.filesPackages.set(this.key(this.version, consumer), filesPackage);
  }

  protected create(consumer: string) {
    const filesPackage = this.filesPackageFactory.create(
      this.cdnUrls,
      this.fetchRetryCount,
      this.fetchTimeout,
      this.version,
      consumer,
      this.encryptSecret,
      this.log,
    );

    filesPackage.on(EventName.FileUpdated, (data) =>
      this.emit(EventName.FileUpdated, data),
    );
    filesPackage.on(EventName.ManifestFetched, (data) =>
      this.emit(EventName.ManifestFetched, data),
    );

    return filesPackage;
  }

  protected key(version: string, consumer: string) {
    return `${version}:${consumer}`;
  }

  private stringifyMatcher(matcher: unknown) {
    if (typeof matcher === 'function') {
      return '[function matcher]';
    }

    return JSON.stringify(matcher);
  }
}
