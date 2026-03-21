import { Veresk } from './veresk';
import log from './mocks/log';

export class VereskMock extends Veresk {
  constructor(protected readonly dataStubs: Record<string, any>) {
    super({
      cdnUrls: ['http://cdn.example.com/'],
      version: 'tests',
      consumer: 'tests',
      log,
    });
    this.set(this.consumer);
  }

  update() {
    return Promise.resolve();
  }

  getMockedSettings() {
    return this.get(this.consumer);
  }

  protected create(consumer: string) {
    return this.settingsPackageFactory.createMock(
      this.cdnUrls,
      this.fetchRetryCount,
      this.fetchTimeout,
      this.version,
      consumer,
      this.log,
      this.dataStubs,
    );
  }
}
