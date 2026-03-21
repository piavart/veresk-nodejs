import { Veresk } from '../../veresk';
import {
  TEmittedVereskError,
  TManifestFetchedEventData,
  TVereskOptions,
  TUpdateSettingEventData,
} from '../../interfaces';
import {
  AB_TESTS_LIST_CONFIG,
  CLEAR_TIMEOUT,
  MAIN_VERESK_NAME,
} from './constants';
import { TSetting_abTests_item, TSetting_abTests } from './types';
import { ILog } from '../../interfaces';
import { EventName } from '../../constants';
import { EventEmitter } from 'events';

export interface AbVereskCore {
  on(
    event: typeof EventName.Error,
    listener: (error: TEmittedVereskError) => void,
  ): this;
  on(
    event: typeof EventName.ManifestFetched,
    listener: (data: TManifestFetchedEventData) => void,
  ): this;
}
export abstract class AbVereskCore extends EventEmitter {
  protected readonly veresks: Map<string, Veresk> = new Map();
  protected readonly log: ILog;

  constructor(protected readonly options: TVereskOptions) {
    super();
    this.log = options.log || console;
  }

  public async init() {
    const mainVeresk = new Veresk(this.options);
    this.registerVeresk(MAIN_VERESK_NAME, mainVeresk);
    await mainVeresk.init();

    const abTests = mainVeresk.getSetting<TSetting_abTests_item>(
      AB_TESTS_LIST_CONFIG,
    );

    if (!abTests) {
      throw new Error(`(AbVeresk) ${AB_TESTS_LIST_CONFIG} config not found!`);
    }

    await this.updateAbTestsVeresks(abTests);

    mainVeresk.on(
      EventName.SettingUpdated,
      async (data: TUpdateSettingEventData) => {
        if (data.name === AB_TESTS_LIST_CONFIG) {
          await this.updateAbTestsVeresks(data.data);
        }
      },
    );
    mainVeresk.on(EventName.ManifestFetched, (data) =>
      this.emit(EventName.ManifestFetched, data),
    );
  }

  public getVeresk(abTestName: string | undefined | null) {
    if (!abTestName) {
      return this.veresks.get(MAIN_VERESK_NAME) as Veresk;
    }
    const veresk = this.veresks.get(abTestName);
    if (!veresk) {
      throw new Error(`(AbVeresk) veresk "${abTestName}" not found!`);
    }
    return veresk;
  }

  private async updateAbTestsVeresks(abTests: TSetting_abTests) {
    const promises: Promise<any>[] = [];

    for (const abTest of abTests) {
      const veresk = this.veresks.get(abTest.name);
      if (!veresk) {
        promises.push(this.initAbTestVeresk(abTest));
        continue;
      }
      if (veresk.version !== abTest.settingsVersion) {
        promises.push(this.initAbTestVeresk(abTest));
      }
    }

    for (const name of this.veresks.keys()) {
      if (name === MAIN_VERESK_NAME) continue;

      const exists = abTests.find((abTest) => abTest.name === name);
      if (!exists) {
        setTimeout(() => this.destroyVeresk(name), CLEAR_TIMEOUT);
      }
    }
    await Promise.all(promises);
  }

  private registerVeresk(name: string, veresk: Veresk) {
    veresk.on(EventName.Error, (data) => {
      this.emit(EventName.Error, data);
    });
    this.veresks.set(name, veresk);
  }

  private destroyVeresk(abTestName: string) {
    if (abTestName === MAIN_VERESK_NAME) {
      throw new Error('(AbVeresk) Main veresk cannot be destroyed!');
    }
    const veresk = this.veresks.get(abTestName) as Veresk;
    veresk.reset();
    this.veresks.delete(abTestName);
    this.log.log(
      `veresk for AB "${abTestName}" was destroyed`,
      `(${this.constructor.name})`,
    );
  }

  private async initAbTestVeresk(abTest: TSetting_abTests_item) {
    const veresk = new Veresk({
      ...this.options,
      version: abTest.settingsVersion,
    });
    await veresk.init();
    if (this.veresks.has(abTest.name)) {
      this.destroyVeresk(abTest.name);
    }
    this.registerVeresk(abTest.name, veresk);
  }
}
