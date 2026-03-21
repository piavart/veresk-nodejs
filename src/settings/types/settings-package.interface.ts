import { EventName } from '../../constants';
import {
  TManifestFetchedEventData,
  TUpdateSettingEventData,
} from '../../interfaces';
import { Manifest } from '../manifest';

export interface ISettingsPackage {
  manifest: Manifest;
  contentUrls: string[];
  get<T = any>(name: string): T;
  update(): Promise<void>;
  reset(): void;
  on(
    event: typeof EventName.SettingUpdated,
    listener: (data: TUpdateSettingEventData) => void,
  ): this;
  on(
    event: typeof EventName.ManifestFetched,
    listener: (data: TManifestFetchedEventData) => void,
  ): this;
}
