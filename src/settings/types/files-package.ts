import { AES, enc } from 'crypto-js';
import { EventEmitter } from 'events';

import {
  ILog,
  TFileManifest,
  TManifest,
  TManifestFetchedEventData,
} from '../../interfaces';
import { Manifest } from '../manifest';
import { File } from '../file';
import { IFilesPackage } from './files-package.interface';
import { ManifestNotFoundError, UnexpectedFileError } from '../../errors';
import { DecryptFileError } from '../../errors';
import { deepFreeze } from '../../utils/freeze';
import { EventName } from '../../constants';
import { Fetcher } from '../fetcher';

export class FilesPackage extends EventEmitter implements IFilesPackage {
  protected _manifest?: Manifest;
  protected files = new Map<string, File>();
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
    const file = this.files.get(name) as File<T> | undefined;

    if (!file) {
      throw new UnexpectedFileError(name);
    }

    return file;
  }

  async update() {
    const { etag, manifest } = await this.fetchManifest();

    if (this.manifestEtag === etag) {
      return;
    }

    await this.updateFiles(this.getChangedFiles(manifest));
    this.cleanupRemovedFiles(manifest);
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

  protected getChangedFiles(manifest: TManifest) {
    return manifest.filter(
      (file) => file.etag !== this.files.get(file.name)?.etag,
    );
  }

  protected cleanupRemovedFiles(manifest: TManifest) {
    const activeFiles = new Set(manifest.map((file) => file.name));
    const removedFiles = Array.from(this.files.keys()).filter(
      (name) => !activeFiles.has(name),
    );

    removedFiles.forEach((name) => {
      this.files.delete(name);
    });

    if (removedFiles.length) {
      this.log.log(
        `Removed stale files for ${this.consumer}: ${removedFiles.join(', ')}`,
        this.logMarker,
      );
    }
  }

  protected async updateFiles(manifests: TFileManifest[]) {
    const files = await Promise.all(
      manifests.map((file) => this.fetchFile(file)),
    );

    for (const { name, etag, data } of files) {
      this.files.set(name, new File(name, etag, data));
      this.emit(EventName.FileUpdated, {
        name,
        consumer: this.consumer,
        etag,
        data,
      });
    }

    this.log.log(`Package ${this.consumer} updated`, this.logMarker);
  }

  protected async fetchFile(fileManifest: TFileManifest) {
    const result = await this.fetcher.fetchSetting(fileManifest.key);

    if (fileManifest.encrypt) {
      try {
        const bytes = AES.decrypt(result.data as string, this.encryptSecret);
        result.data = JSON.parse(bytes.toString(enc.Utf8));
      } catch (err: any) {
        throw new DecryptFileError(fileManifest.name, err.stack);
      }
    }

    return {
      name: fileManifest.name,
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
