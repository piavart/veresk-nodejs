import axios from 'axios';
import { CdnUrlsProvider } from './cdn-urls.provider';
import { TManifest } from '../interfaces';
import { FetchSettingError } from '../errors';

export class FetchError extends Error {
  constructor(
    public readonly url: string,
    public readonly cause?: unknown,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(
      `Fetch failed for ${url}${
        status || code
          ? ` (${[status && `status: ${status}`, code && `code: ${code}`]
              .filter(Boolean)
              .join(', ')})`
          : ''
      }`,
    );
    this.name = 'FetchError';

    if (cause instanceof Error && cause.stack) {
      this.stack = cause.stack;
    }
  }

  public static from(url: string, error: unknown) {
    const status =
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof (error as any).response?.status === 'number'
        ? (error as any).response.status
        : undefined;

    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as any).code === 'string'
        ? (error as any).code
        : undefined;

    return new FetchError(url, error, status, code);
  }
}

export class Fetcher {
  protected readonly fetchRetryCount: number;
  protected readonly cdnUrlsProvider: CdnUrlsProvider;

  constructor(
    cdnUrls: string[],
    private readonly fetchTimeout: number,
    fetchRetryCount: number,
  ) {
    this.fetchRetryCount = Math.max(0, fetchRetryCount || 0);
    this.cdnUrlsProvider = new CdnUrlsProvider(cdnUrls);
  }

  public async fetchManifest(version: string, consumer: string) {
    const result = await this.fetchWithRetry<TManifest>(
      `/${version}/manifests/${consumer}`,
      {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    );

    return result;
  }

  public async fetchSetting(path: string) {
    try {
      return await this.fetchWithRetry(path, {});
    } catch (e: any) {
      throw new FetchSettingError(e.url, e.stack);
    }
  }

  private async fetchWithRetry<T = unknown>(
    path: string,
    headers: Record<string, string>,
  ) {
    const attemptsCount = this.fetchRetryCount + 1;
    let lastError: FetchError | undefined;

    for (let attempt = 0; attempt < attemptsCount; attempt++) {
      const cdnUrl = this.cdnUrlsProvider.getUrl();
      const url = `${cdnUrl}${path}`;

      try {
        return await this.fetch<T>(url, headers);
      } catch (error: unknown) {
        lastError = FetchError.from(url, error);

        if (attempt < attemptsCount - 1) {
          this.cdnUrlsProvider.switchUrl();
        }
      }
    }

    throw (
      lastError ||
      new FetchError(path, new Error(`fetch attempts exhausted for ${path}`))
    );
  }

  private async fetch<T>(
    url: string,
    headers: Record<string, string>,
  ): Promise<{ etag: string; data: T; url: string }> {
    const resp = await axios.get(url, { timeout: this.fetchTimeout, headers });
    const rawEtag = resp.headers?.etag;

    if (typeof rawEtag !== 'string') {
      throw new Error(`Response does not contain ETag header for ${url}`);
    }

    const etag = rawEtag.replace(/"/g, '');
    return { etag, data: resp.data, url };
  }
}
