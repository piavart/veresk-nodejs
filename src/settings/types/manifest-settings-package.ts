import { ILog } from '../../interfaces';
import { Manifest } from '../manifest';
import { SettingsPackage } from './settings-package';

export class ManifestSettingsPackage extends SettingsPackage {
  constructor(
    cdnUrls: string[],
    fetchRetryCount: number,
    fetchTimeout: number,
    version: string,
    consumer: string,
    encryptSecret: string,
    log: ILog,
  ) {
    super(
      cdnUrls,
      fetchRetryCount,
      fetchTimeout,
      version,
      consumer,
      encryptSecret,
      log,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  get<T = any>(_name: string): T {
    throw new Error(
      `settings with ${this.version}, ${this.consumer} should use manifest only`,
    );
  }

  async update() {
    const { etag, manifest } = await this.fetchManifest();

    if (this._manifest?.etag === etag) {
      return;
    }

    this._manifest = new Manifest(etag, manifest);

    this.log.log(
      `Manifest updated for ${this.version} ${
        this.consumer
      }. ETag: ${etag}. Mode: 'manifest'. ContentUrl: ${this.contentUrls.join(
        ' ,',
      )}`,
      this.logMarker,
    );
  }
}
