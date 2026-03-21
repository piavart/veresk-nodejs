# @veresk/nodejs

`@veresk/nodejs` is a Node.js client for Veresk remote configuration, feature flags, and AB-test driven settings bundles.

It downloads manifests and settings from one or more CDN endpoints, keeps them in memory, emits update events, and exposes a lightweight mock for tests.

## Installation

```bash
npm install @veresk/nodejs
```

## Requirements

- Node.js `18+`
- HTTPS-accessible Veresk CDN endpoints in production

## Quick Start

```ts
import { SettingType, Veresk } from '@veresk/nodejs';

const veresk = new Veresk({
  cdnUrls: ['https://cdn.example.com'],
  version: 'default',
  consumer: 'common',
  expireMs: 60_000,
  fetchRetryCount: 1,
  fetchTimeout: 1_500,
  encryptSecret: process.env.VERESK_SECRET,
});

veresk.on('error', (error) => {
  console.error(error);
});

veresk.on('manifest-fetched', (event) => {
  console.log('manifest status', event);
});

await veresk.init();

const featureFlags =
  veresk.getSingleton<Record<string, boolean>>('featureFlags');

const experiments = await veresk.fetchSetting<{
  name: string;
  enabled: boolean;
}>('experiments', {
  type: SettingType.List,
});
```

## API

### `new Veresk(options)`

Available options:

- `cdnUrls: string[]` required. Ordered list of CDN base URLs.
- `version: string` required. Settings version to load.
- `consumer: string` required. Default consumer for this client instance.
- `expireMs?: number` polling interval for manifest refresh. Default: `60000`.
- `fetchRetryCount?: number` additional retry attempts across configured CDNs. Default: `0`.
- `fetchTimeout?: number` timeout per HTTP request in milliseconds. Default: `1500`.
- `encryptSecret?: string` shared secret for encrypted settings payloads.
- `log?: ILog` custom logger with `log`, `warn`, and `error`.

### `await veresk.init()`

Loads the initial manifest and settings package, then starts background polling.

### `veresk.reset()`

Stops polling and clears event listeners for the instance.

### `await veresk.fetchManifest(consumer)`

Loads and returns manifest metadata for a consumer.

### `veresk.getManifest(consumer)`

Returns the last loaded manifest from memory.

### `await veresk.fetchSetting(name, options?)`

Ensures data is loaded and returns a setting. For list settings, `filter` and `find` can be used to select items.

### `veresk.getSetting(name, options?)`

Returns a setting from memory without triggering network IO.

### `veresk.getSingleton(name, options?)`

Convenience helper for non-array settings.

## Events

The client emits these events:

- `setting-updated` with `{ name, consumer, etag, data }`
- `manifest-fetched` with `{ success, uri, time, changed }`
- `error` with `ManifestNotFoundError | FetchSettingError`

The `VereskEventName` export is available if you prefer constants over string literals.

## Test Mocks

Use `VereskMock` to test consumers without network access:

```ts
import { VereskMock } from '@veresk/nodejs';

const veresk = new VereskMock({
  items: [
    { id: 0, name: 'item-0' },
    { id: 1, name: 'item-1' },
  ],
});

veresk.getMockedSettings().replaceSetting('items', [
  { id: 0, name: 'updated-item-0' },
  { id: 1, name: 'item-1' },
]);

const item = veresk.getSetting<{ id: number; name: string }>('items', {
  find: { id: 0 },
});
```

## AB Tests

`AbVeresk` manages multiple `Veresk` instances based on the `abTests` configuration and routes reads by experiment name:

```ts
import { AbVeresk } from '@veresk/nodejs';

const abVeresk = new AbVeresk({
  cdnUrls: ['https://cdn.example.com'],
  version: 'default',
  consumer: 'common',
});

await abVeresk.init();

const config = abVeresk.getSingleton('landingPage', 'experiment-a');
```

## Security Notes

- Prefer `https://` CDN URLs in production.
- Treat remote settings as untrusted input and validate shapes in application code.
- If you use encrypted settings, protect `encryptSecret` the same way you protect other application secrets.
