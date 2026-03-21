import { SettingType } from '../..';
import { TVereskOptions } from '../../interfaces';
import { AbVereskCore } from './ab-veresk-core';

export class AbVeresk extends AbVereskCore {
  constructor(options: TVereskOptions) {
    super(options);
  }

  async fetchManifest(consumer: string, abTestName: string | undefined | null) {
    const veresk = this.getVeresk(abTestName);
    return veresk.fetchManifest(consumer);
  }

  getManifest(consumer: string, abTestName: string | undefined | null) {
    const veresk = this.getVeresk(abTestName);
    return veresk.getManifest(consumer);
  }

  async fetchSetting<T = any>(
    name: string,
    abTestName: string | undefined | null,
    options: {
      consumer?: string;
      filter?: undefined;
      find?: undefined;
      type: SettingType.Singleton;
    },
  ): Promise<T>;
  async fetchSetting<T = any>(
    name: string,
    abTestName: string | undefined | null,
    options: {
      consumer?: string;
      filter?: Partial<T>;
      find: Partial<T>;
      type?: SettingType.List;
    },
  ): Promise<T>;
  async fetchSetting<T = any>(
    name: string,
    abTestName: string | undefined | null,
    options: {
      consumer?: string;
      filter?: Partial<T>;
      find: (item: T) => boolean;
      type?: SettingType.List;
    },
  ): Promise<T>;
  async fetchSetting<T = any>(
    name: string,
    abTestName: string | undefined | null,
    options?: {
      consumer?: string;
      filter?: Partial<T>;
      find?: Partial<T>;
      type?: SettingType;
    },
  ): Promise<T[]>;
  async fetchSetting<T = any>(
    name: string,
    abTestName: string | undefined | null,
    options: {
      consumer?: string;
      filter?: Partial<T>;
      find?: Partial<T>;
      type?: SettingType;
    } = {},
  ) {
    const veresk = this.getVeresk(abTestName);
    return veresk.fetchSetting(name, options);
  }

  getSetting<T = any>(
    name: string,
    abTestName: string | undefined | null,
    options: {
      consumer?: string;
      filter?: undefined;
      find?: undefined;
      type: SettingType.Singleton;
    },
  ): T;
  getSetting<T = any>(
    name: string,
    abTestName: string | undefined | null,
    options: {
      consumer?: string;
      filter?: Partial<T>;
      find: Partial<T>;
      type?: SettingType.List;
    },
  ): T;
  getSetting<T = any>(
    name: string,
    abTestName: string | undefined | null,
    options?: {
      consumer?: string;
      filter?: Partial<T>;
      find?: Partial<T>;
      type?: SettingType;
    },
  ): T[];
  getSetting<T = any>(
    name: string,
    abTestName: string | undefined | null,
    options: {
      consumer?: string;
      filter?: Partial<T>;
      find: (item: T) => boolean;
      type?: SettingType.List;
    },
  ): T;
  getSetting<T = any>(
    name: string,
    abTestName: string | undefined | null,
    options: {
      consumer?: string;
      filter?: Partial<T>;
      find?: Partial<T>;
      type?: SettingType;
    } = {},
  ) {
    const veresk = this.getVeresk(abTestName);
    return veresk.getSetting(name, options);
  }

  /**
   * @description get singleton setting
   */
  getSingleton<T extends Record<string, any> = Record<string, any>>(
    name: string,
    abTestName: string | undefined | null,
    options: {
      consumer?: string;
    } = {},
  ): T {
    const veresk = this.getVeresk(abTestName);
    return veresk.getSingleton(name, options);
  }
}
