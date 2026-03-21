import {
  ConfigureError,
  FetchSettingError,
  ManifestNotFoundError,
} from './errors';
import { EventEmitter } from 'events';
import {
  TVereskOptions,
  SettingType,
  ILog,
  TUpdateSettingEventData,
  TEmittedVereskError,
  TManifestFetchedEventData,
} from './interfaces';
import { SettingsPackageFactory } from './settings/settings-package.factory';
import { ISettingsPackage } from './settings/types/settings-package.interface';
import { EventName, FETCH_TIMEOUT_MS } from './constants';
import { findInCollection, filterCollection } from './utils/matchers';

export interface Veresk {
  on(
    event: typeof EventName.SettingUpdated,
    listener: (data: TUpdateSettingEventData) => void,
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

  protected readonly settingsPackageFactory: SettingsPackageFactory;
  protected readonly settingsPackages = new Map<string, ISettingsPackage>();

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

    this.settingsPackageFactory = new SettingsPackageFactory(this.consumer);
    this.set(this.consumer);

    this.log.log(
      `Veresk initialized: expireMs: ${
        this.expireMs
      } cdnUrls: ${this.cdnUrls.join(' ,')} version: ${this.version} consumer: ${
        this.consumer
      }`,
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
      for (const settingsPackage of this.settingsPackages.values()) {
        promises.push(settingsPackage.update());
      }
      await Promise.all(promises);
    } catch (err: unknown) {
      this.log.error(err, `(${this.constructor.name})`);

      if (
        err instanceof ManifestNotFoundError ||
        err instanceof FetchSettingError
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
    for (const settingsPackage of this.settingsPackages.values()) {
      settingsPackage.reset();
    }
    this.settingsPackages.clear();
  }

  async fetchManifest(consumer: string) {
    await this.loadIfNeed(consumer);
    return this.getManifest(consumer);
  }

  getManifest(consumer: string) {
    const settingsPackage = this.get(consumer);

    return {
      etag: settingsPackage.manifest.etag,
      manifest: settingsPackage.manifest.data,
      contentUrls: settingsPackage.contentUrls,
    };
  }

  async fetchSetting<T = any>(
    name: string,
    options: {
      consumer?: string;
      filter?: undefined;
      find?: undefined;
      type: SettingType.Singleton;
    },
  ): Promise<T>;
  async fetchSetting<T = any>(
    name: string,
    options: {
      consumer?: string;
      filter?: Partial<T>;
      find: Partial<T>;
      type?: SettingType.List;
    },
  ): Promise<T>;
  async fetchSetting<T = any>(
    name: string,
    options: {
      consumer?: string;
      filter?: Partial<T>;
      find: (item: T) => boolean;
      type?: SettingType.List;
    },
  ): Promise<T>;
  async fetchSetting<T = any>(
    name: string,
    options?: {
      consumer?: string;
      filter?: Partial<T>;
      find?: Partial<T>;
      type?: SettingType;
    },
  ): Promise<T[]>;
  async fetchSetting<T = any>(
    name: string,
    options: {
      consumer?: string;
      filter?: Partial<T>;
      find?: Partial<T>;
      type?: SettingType;
    } = {},
  ) {
    const { consumer = this.consumer } = options;

    await this.loadIfNeed(consumer);
    return this.getSetting(name, options);
  }

  getSetting<T = any>(
    name: string,
    options: {
      consumer?: string;
      filter?: undefined;
      find?: undefined;
      type: SettingType.Singleton;
    },
  ): T;
  getSetting<T = any>(
    name: string,
    options: {
      consumer?: string;
      filter?: Partial<T>;
      find: Partial<T>;
      type?: SettingType.List;
    },
  ): T;
  getSetting<T = any>(
    name: string,
    options: {
      consumer?: string;
      filter?: Partial<T>;
      find: (item: T) => boolean;
      type?: SettingType.List;
    },
  ): T;
  getSetting<T = any>(
    name: string,
    options?: {
      consumer?: string;
      filter?: Partial<T>;
      find?: Partial<T>;
      type?: SettingType;
    },
  ): T[];
  getSetting<T = any>(
    name: string,
    options: {
      consumer?: string;
      filter?: Partial<T>;
      find?: Partial<T>;
      type?: SettingType;
    } = {},
  ) {
    const {
      consumer = this.consumer,
      find,
      filter,
      type = SettingType.List,
    } = options;

    const settingsPackage = this.get(consumer);
    let setting = settingsPackage.get(name);
    const isList = Array.isArray(setting);

    if (type === SettingType.List && !isList) {
      throw new Error(`(Veresk) setting ${name} expected to be a list`);
    }

    if (type === SettingType.Singleton && isList) {
      throw new Error(`(Veresk) setting ${name} expected to be a singleton`);
    }

    if (!Array.isArray(setting)) {
      return setting;
    }

    if (filter) {
      setting = filterCollection(setting, filter);
    }

    if (find) {
      setting = findInCollection(setting, find);

      if (!setting) {
        throw new Error(
          `could not find setting ${name} with find params ${JSON.stringify(
            find,
          )}`,
        );
      }
    }

    return setting;
  }

  /**
   * @description get singleton setting
   */
  getSingleton<T extends Record<string, any> = Record<string, any>>(
    name: string,
    options: {
      consumer?: string;
    } = {},
  ): T {
    const { consumer = this.consumer } = options;

    return this.getSetting<T>(name, {
      consumer,
      type: SettingType.Singleton,
    });
  }

  private async loadIfNeed(consumer: string) {
    if (this.has(consumer)) {
      return;
    }

    const settingsPackage = this.create(consumer);
    await settingsPackage.update();
    settingsPackage.on(EventName.ManifestFetched, (data) =>
      this.emit(EventName.ManifestFetched, data),
    );

    this.settingsPackages.set(
      this.key(this.version, consumer),
      settingsPackage,
    );
  }

  protected has(consumer: string) {
    return this.settingsPackages.has(this.key(this.version, consumer));
  }

  protected get(consumer: string) {
    const settingsPackage = this.settingsPackages.get(
      this.key(this.version, consumer),
    );

    if (!settingsPackage) {
      throw new Error(
        `could not find setting for ${this.version}, ${consumer}`,
      );
    }

    return settingsPackage;
  }

  protected set(consumer: string) {
    const settingsPackage = this.create(consumer);

    this.settingsPackages.set(
      this.key(this.version, consumer),
      settingsPackage,
    );
  }

  protected create(consumer: string) {
    const settingsPackage = this.settingsPackageFactory.create(
      this.cdnUrls,
      this.fetchRetryCount,
      this.fetchTimeout,
      this.version,
      consumer,
      this.encryptSecret,
      this.log,
    );

    settingsPackage.on(EventName.SettingUpdated, (data) =>
      this.emit(EventName.SettingUpdated, data),
    );

    return settingsPackage;
  }

  protected key(version: string, consumer: string) {
    return `${version}${consumer}`;
  }
}
