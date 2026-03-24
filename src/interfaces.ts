import { FetchFileError, ManifestNotFoundError } from './errors';

export type TVereskOptions = {
  cdnUrls: string[];
  fetchRetryCount?: number;
  fetchTimeout?: number;
  version: string;
  consumer: string;
  encryptSecret?: string;
  expireMs?: number;
  log?: ILog;
};

export type TFileManifest = {
  name: string;
  key: string;
  etag: string;
  size: number;
  encrypt: boolean;
};

export type TManifest = TFileManifest[];

export type TUpdateFileEventData = {
  name: string;
  consumer: string;
  etag: string;
  data: any;
};

export interface ILog {
  log(...ars: any[]): void;
  warn(...ars: any[]): void;
  error(...ars: any[]): void;
}

export type TEmittedVereskError = ManifestNotFoundError | FetchFileError;

export type TManifestFetchedEventData =
  | {
      success: true;
      uri: string;
      time: number;
      changed: boolean;
    }
  | {
      success: false;
      uri: string;
      time: number;
    };
