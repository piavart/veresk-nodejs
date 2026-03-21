/* eslint-disable @typescript-eslint/no-unused-vars */
import { AbVeresk } from './ab-veresk';
import log from '../../mocks/log';
import { VereskMock } from '../../veresk-mock';

export class AbVereskMock extends AbVeresk {
  mock: VereskMock;

  constructor(dataStubs: Record<string, any>) {
    super({
      cdnUrls: ['http://cdn.example.com/'],
      version: 'tests',
      consumer: 'tests',
      log,
    });
    this.mock = new VereskMock(dataStubs);
  }

  async init() {
    return;
  }

  public getVeresk(abTestName: string | undefined | null) {
    return this.mock;
  }
}
