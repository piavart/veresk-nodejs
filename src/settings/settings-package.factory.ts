import { ISettingsPackage } from './types/settings-package.interface';
import { SettingsPackage } from './types/settings-package';
import { ManifestSettingsPackage } from './types/manifest-settings-package';
import { MockSettingsPackage } from './types/mock-settings-package';
import { ILog } from '../interfaces';

export class SettingsPackageFactory {
  constructor(protected readonly consumer: string) {}

  create(
    cdnUrls: string[],
    fetchRetryCount: number,
    fetchTimeout: number,
    version: string,
    consumer: string,
    encryptSecret: string,
    log: ILog,
  ): ISettingsPackage {
    if (this.consumer === consumer) {
      return new SettingsPackage(
        cdnUrls,
        fetchRetryCount,
        fetchTimeout,
        version,
        consumer,
        encryptSecret,
        log,
      );
    }

    return new ManifestSettingsPackage(
      cdnUrls,
      fetchRetryCount,
      fetchTimeout,
      version,
      consumer,
      encryptSecret,
      log,
    );
  }

  createMock(
    cdnUrls: string[],
    fetchRetryCount: number,
    fetchTimeout: number,
    version: string,
    consumer: string,
    log: ILog,
    dataStubs: Record<string, any>,
  ) {
    return new MockSettingsPackage(
      cdnUrls,
      fetchRetryCount,
      fetchTimeout,
      version,
      consumer,
      '',
      log,
      dataStubs,
    );
  }
}
