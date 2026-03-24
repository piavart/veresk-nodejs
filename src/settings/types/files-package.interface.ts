import { EventName } from '../../constants';
import {
  TManifestFetchedEventData,
  TUpdateFileEventData,
} from '../../interfaces';
import { File } from '../file';
import { Manifest } from '../manifest';

export interface IFilesPackage {
  manifest: Manifest;
  contentUrls: string[];
  get<T = any>(name: string): File<T>;
  update(): Promise<void>;
  reset(): void;
  on(
    event: typeof EventName.FileUpdated,
    listener: (data: TUpdateFileEventData) => void,
  ): this;
  on(
    event: typeof EventName.ManifestFetched,
    listener: (data: TManifestFetchedEventData) => void,
  ): this;
}
