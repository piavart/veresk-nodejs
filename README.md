# @veresk-tool/nodejs

`@veresk-tool/nodejs` is a Node.js client for Veresk remote files and feature-flag/config payloads.

It downloads manifests and file contents from one or more CDN endpoints, keeps them in memory, emits update events, and ships with a lightweight mock for tests.

## Installation

```bash
npm install @veresk-tool/nodejs
```

## Requirements

- Node.js `18+`
- HTTPS-accessible Veresk CDN endpoints in production

## Quick Start

```ts
import { Veresk, VereskEventName } from '@veresk-tool/nodejs';

type FeatureFlags = Record<string, boolean>;

type Experiment = {
  name: string;
  enabled: boolean;
};

const veresk = new Veresk({
  cdnUrls: ['https://cdn.example.com'],
  version: 'default',
  consumer: 'common',
  expireMs: 60_000,
  fetchRetryCount: 1,
  fetchTimeout: 1_500,
  encryptSecret: process.env.VERESK_SECRET,
});

veresk.on(VereskEventName.Error, (error) => {
  console.error(error);
});

veresk.on(VereskEventName.ManifestFetched, (event) => {
  console.log('manifest status', event);
});

veresk.on(VereskEventName.FileUpdated, ({ name, etag }) => {
  console.log(`updated ${name} (${etag})`);
});

await veresk.init();

const featureFlags = veresk.getContent<FeatureFlags>('featureFlags');

const experiments = await veresk.fetchContent<Experiment[]>('experiments');

const enabledExperiment = veresk.getAsListOrThrow<Experiment[]>('experiments', {
  find: { name: 'checkout-redesign' },
});
```

## API

### `new Veresk(options)`

Available options:

- `cdnUrls: string[]` required. Ordered list of CDN base URLs.
- `version: string` required. Files version to load.
- `consumer: string` required. Default consumer for this client instance.
- `expireMs?: number` polling interval for manifest refresh. Default: `60000`.
- `fetchRetryCount?: number` additional retry attempts across configured CDNs. Default: `0`.
- `fetchTimeout?: number` timeout per HTTP request in milliseconds. Default: `1500`.
- `encryptSecret?: string` shared secret for encrypted file payloads.
- `log?: ILog` custom logger with `log`, `warn`, and `error`.

### `await veresk.init()`

Loads the initial manifest and files package, then starts background polling.

### `veresk.reset()`

Stops polling, removes listeners, and clears loaded packages from memory.

### `await veresk.fetchManifest(consumer)`

Ensures the package for `consumer` is loaded and returns:

```ts
{
  etag: string;
  manifest: TManifest;
  contentUrls: string[];
}
```

### `veresk.getManifest(consumer)`

Returns the last loaded manifest from memory.

### `await veresk.fetchContent(name, options?)`

Ensures data is loaded for the target consumer, then returns file content.

Use it like this:

- `fetchContent<MyObject>('featureFlags')` for a non-array file
- `fetchContent<MyItem[]>('experiments')` for the whole array file
- `fetchContent<MyItem>('experiments', { filter: { enabled: true } })` for a filtered array
- `fetchContent<MyItem>('experiments', { find: { name: 'checkout-redesign' } })` for a single matching array item

Options:

- `consumer?: string`
- `filter?: Partial<T>`
- `find?: Partial<T> | ((item: T) => boolean)`

When `find` is used, the method throws if no item matches.

### `veresk.getContent(name, consumer?)`

Returns the raw file content from memory without network IO.

This is the lowest-level getter and works for both singleton and array-shaped files.

### `veresk.getAsList(name, options?)`

Convenience helper for array-shaped files already loaded in memory.

Behavior:

- without `find` it returns the whole array
- with `filter` it returns a filtered array
- with `find` it returns a single item or `undefined`

If the file content is not an array, the method throws.

Example:

```ts
type Experiment = {
  name: string;
  enabled: boolean;
};

const experiments = veresk.getAsList<Experiment[]>('experiments', {
  filter: { enabled: true },
});
```

### `veresk.getAsListOrThrow(name, options?)`

Same as `getAsList`, but when `find` is used it throws if no item matches.

Example:

```ts
type Experiment = {
  name: string;
  enabled: boolean;
};

const experiment = veresk.getAsListOrThrow<Experiment[]>('experiments', {
  find: { name: 'checkout-redesign' },
});
```

## Events

The client emits these events:

- `file-updated` with `{ name, consumer, etag, data }`
- `manifest-fetched` with `{ success, uri, time, changed }`
- `error` with `ManifestNotFoundError | FetchFileError`

The package exports `VereskEventName` if you prefer constants over string literals.

## Test Mocks

Use `VereskMock` to test consumers without network access:

```ts
import { VereskMock } from '@veresk-tool/nodejs';

type Item = {
  id: number;
  name: string;
};

const veresk = new VereskMock({
  items: [
    { id: 0, name: 'item-0' },
    { id: 1, name: 'item-1' },
  ],
});

const item = veresk.getAsListOrThrow<Item[]>('items', {
  find: { id: 0 },
});
```

`VereskMock` uses the same read API as `Veresk`, so test code can usually stay unchanged.

## Security Notes

- Prefer `https://` CDN URLs in production.
- Treat remote file contents as untrusted input and validate shapes in application code.
- If you use encrypted files, protect `encryptSecret` the same way you protect other application secrets.
