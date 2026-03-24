import { IFilesPackage } from './types/files-package.interface';
import { FilesPackage } from './types/files-package';
import { ManifestFilesPackage } from './types/manifest-files-package';
import { MockFilesPackage } from './types/mock-files-package';
import { ILog } from '../interfaces';

export class FilesPackageFactory {
  constructor(protected readonly consumer: string) {}

  create(
    cdnUrls: string[],
    fetchRetryCount: number,
    fetchTimeout: number,
    version: string,
    consumer: string,
    encryptSecret: string,
    log: ILog,
  ): IFilesPackage {
    if (this.consumer === consumer) {
      return new FilesPackage(
        cdnUrls,
        fetchRetryCount,
        fetchTimeout,
        version,
        consumer,
        encryptSecret,
        log,
      );
    }

    return new ManifestFilesPackage(
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
    return new MockFilesPackage(
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
