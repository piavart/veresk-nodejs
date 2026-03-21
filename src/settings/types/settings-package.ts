import {
  ILog,
  TFileManifest,
  TManifest,
  TManifestFetchedEventData,
} from '../../interfaces';
import { Manifest } from '../manifest';
import { Setting } from '../setting';
import { ISettingsPackage } from './settings-package.interface';
import { EventEmitter } from 'events';
import { ManifestNotFoundError, UnexpectedSettingError } from '../../errors';
import { AES, enc } from 'crypto-js';
import { DecryptSettingError } from '../../errors';
import { deepFreeze } from '../../utils/freeze';
import { EventName } from '../../constants';
import { Fetcher } from '../fetcher';

export class SettingsPackage extends EventEmitter implements ISettingsPackage {
  protected _manifest?: Manifest;
  protected settings = new Map<string, Setting>();
  protected readonly logMarker: string;
  protected readonly fetcher: Fetcher;

  constructor(
    private readonly cdnUrls: string[],
    fetchRetryCount: number,
    fetchTimeout: number,
    protected readonly version: string,
    protected readonly consumer: string,
    protected readonly encryptSecret: string,
    protected readonly log: ILog,
  ) {
    super();
    this.fetcher = new Fetcher(cdnUrls, fetchTimeout, fetchRetryCount);
    this.logMarker = `(Veresk)[${this.constructor.name}:${this.consumer}]`;
  }

  get manifest() {
    if (!this._manifest) {
      throw new Error('manifest is not loaded');
    }

    return this._manifest;
  }

  get contentUrls() {
    return this.cdnUrls.map((url) => `${url}${this.manifest.contentPath}`);
  }

  public get manifestEtag() {
    return this._manifest?.etag;
  }

  get<T = any>(name: string) {
    const setting = this.settings.get(name);

    if (!setting) {
      throw new UnexpectedSettingError(name);
    }

    return setting.data as T;
  }

  async update() {
    const { etag, manifest } = await this.fetchManifest();

    if (this.manifestEtag === etag) {
      return;
    }

    await this.updateSettings(this.getChangedSettings(manifest));
    this.cleanupRemovedSettings(manifest);
    this._manifest = new Manifest(etag, manifest);

    this.log.log(
      `Manifest updated for ${this.version} ${
        this.consumer
      }. ETag: ${etag}. Mode: 'full'. ContentUrls: ${this.contentUrls.join(
        ', ',
      )}`,
      this.logMarker,
    );
  }

  public reset(): void {
    this.removeAllListeners();
  }

  protected getChangedSettings(manifest: TManifest) {
    return manifest.filter(
      (settingManifest) =>
        settingManifest.etag !== this.settings.get(settingManifest.name)?.etag,
    );
  }

  protected cleanupRemovedSettings(manifest: TManifest) {
    const activeSettings = new Set(manifest.map((setting) => setting.name));
    const removedSettings = Array.from(this.settings.keys()).filter(
      (name) => !activeSettings.has(name),
    );

    removedSettings.forEach((name) => {
      this.settings.delete(name);
    });

    if (removedSettings.length) {
      this.log.log(
        `Removed stale settings for ${this.consumer}: ${removedSettings.join(
          ', ',
        )}`,
        this.logMarker,
      );
    }
  }

  protected async updateSettings(settingsManifests: TFileManifest[]) {
    const settings = await Promise.all(
      settingsManifests.map((setting) => this.fetchSetting(setting)),
    );

    for (const { name, etag, data } of settings) {
      this.settings.set(name, new Setting(name, etag, data));
      this.emit(EventName.SettingUpdated, {
        name,
        consumer: this.consumer,
        etag,
        data,
      });
    }

    this.log.log(`Package ${this.consumer} updated`, this.logMarker);
  }

  protected async fetchSetting(settingManifest: TFileManifest) {
    const result = await this.fetcher.fetchSetting(settingManifest.key);

    if (settingManifest.encrypt) {
      try {
        const bytes = AES.decrypt(result.data as string, this.encryptSecret);
        result.data = JSON.parse(bytes.toString(enc.Utf8));
      } catch (err: any) {
        throw new DecryptSettingError(settingManifest.name, err.stack);
      }
    }

    return {
      name: settingManifest.name,
      etag: result.etag,
      data: deepFreeze(result.data),
    };
  }

  protected async fetchManifest(): Promise<{
    etag: string;
    manifest: TManifest;
  }> {
    const start = Date.now();

    try {
      const { etag, data, url } = await this.fetcher.fetchManifest(
        this.version,
        this.consumer,
      );

      this.emit(EventName.ManifestFetched, {
        success: true,
        uri: url,
        time: Date.now() - start,
        changed: this.manifestEtag !== etag,
      } as TManifestFetchedEventData);

      return {
        etag,
        manifest: data,
      };
    } catch (err: any) {
      this.emit(EventName.ManifestFetched, {
        success: false,
        uri: err.url,
        time: Date.now() - start,
      } as TManifestFetchedEventData);

      const error = new ManifestNotFoundError(err.url, err.stack);
      this.log.error(error, this.logMarker);

      if (!this._manifest) {
        throw error;
      }

      return {
        etag: this.manifest.etag,
        manifest: this.manifest.data,
      };
    }
  }
}
