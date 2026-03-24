import { ILog } from '../../interfaces';
import { Manifest } from '../manifest';
import { File } from '../file';
import { FilesPackage } from './files-package';
import { cloneValue, setByPath } from '../../utils/matchers';
import { IFilesPackage } from './files-package.interface';

export class MockFilesPackage extends FilesPackage implements IFilesPackage {
  private changedSettings: Record<string, any> = {};

  constructor(
    cdnUrls: string[],
    fetchRetryCount: number,
    fetchTimeout: number,
    version: string,
    consumer: string,
    encryptSecret: string,
    log: ILog,
    private readonly dataStubs: Record<string, any>,
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

  get manifest() {
    return new Manifest('etagManifest', [
      {
        name: 'fileName',
        key: '/default/common/json/tag/fileName',
        size: 10,
        etag: 'fileEtag',
        encrypt: false,
      },
    ]);
  }

  get<T = any>(name: string) {
    return new File(name, 'mock-etag', this.getSetting(name) as T);
  }

  async update() {
    return Promise.resolve();
  }

  changeSetting(name: string, entries: any) {
    this.changedSettings[name] = this.getStub(name);

    Object.entries(entries).forEach(([key, value]) =>
      setByPath(this.changedSettings[name], key, value),
    );
  }

  replaceSetting(name: string, newSetting: any) {
    this.changedSettings[name] = newSetting;
  }

  restoreSetting(name: string) {
    delete this.changedSettings[name];
  }

  restoreAllSettings() {
    this.changedSettings = {};
  }

  private getSetting(name: string) {
    return this.changedSettings[name] || this.getStub(name);
  }

  private getStub(name: string) {
    return cloneValue(this.dataStubs[name]);
  }
}
