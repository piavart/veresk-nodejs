import { TManifest } from '../interfaces';
import MockAdapter from 'axios-mock-adapter';
import { AES } from 'crypto-js';

export const ENCRYPT_SECRET = "You don't know anything Jon Snow!";

export const manifest: { etag: string; data: TManifest } = {
  etag: 'etagManifest',
  data: [
    {
      name: 'exampleSingleton',
      key: '/default/content/exampleSingleton',
      size: 14,
      etag: 'etagExampleSingletonFile',
      encrypt: false,
    },
    {
      name: 'exampleRetry',
      key: '/default/content/exampleRetry',
      size: 14,
      etag: 'etagExampleRetry',
      encrypt: false,
    },
    {
      name: 'exampleArray',
      key: '/default/content/exampleArray',
      size: 14,
      etag: 'etagExampleArrayFile',
      encrypt: false,
    },
    {
      name: 'encryptedConfig',
      key: '/default/content/encryptedConfig',
      size: 14,
      etag: 'encryptedConfig',
      encrypt: true,
    },
  ],
};

export const exampleSingletonFile = {
  etag: 'etagExampleSingletonFile',
  data: {
    exampleField: 'example value',
    deepField: {
      name: 'SomeName',
    },
  },
};

export const exampleRetryFile = {
  etag: 'etagExampleRetryFile',
  data: {
    exampleField: 'example value',
    deepField: {
      name: 'SomeName',
    },
  },
};

export const exampleArrayFile = {
  etag: 'etagExampleArrayFile',
  data: [
    {
      name: 'John Snow',
      bastard: true,
      dwarf: false,
    },
    {
      name: 'Theon Greyjoy',
      bastard: false,
      dwarf: false,
    },
    {
      name: 'Tyrion Lannister',
      bastard: false,
      dwarf: true,
    },
  ],
};

const ectyptedContent = AES.encrypt(
  JSON.stringify(exampleArrayFile.data),
  ENCRYPT_SECRET,
).toString();

function manifestMock(mock: MockAdapter, cdnUrls: string[]) {
  return mock
    .onGet(`${cdnUrls[0]}/default/manifests/common`)
    .reply(200, manifest.data, { etag: manifest.etag });
}

function exampleSingletonMock(mock: MockAdapter, cdnUrls: string[]) {
  return mock
    .onGet(`${cdnUrls[0]}/default/content/exampleSingleton`)
    .reply(200, exampleSingletonFile.data, {
      etag: exampleSingletonFile.etag,
    });
}

function exampleRetryMock(mock: MockAdapter, cdnUrls: string[]) {
  const url = `${cdnUrls[0]}/default/content/exampleRetry`;
  return mock
    .onGet(url)
    .replyOnce(500)
    .onGet(url)
    .reply(200, exampleRetryFile.data, {
      etag: exampleRetryFile.etag,
    });
}

function exampleArrayMock(mock: MockAdapter, cdnUrls: string[]) {
  return mock
    .onGet(`${cdnUrls[0]}/default/content/exampleArray`)
    .reply(200, exampleArrayFile.data, {
      etag: exampleArrayFile.etag,
    });
}

function encryptedConfigMock(mock: MockAdapter, cdnUrls: string[]) {
  return mock
    .onGet(`${cdnUrls[0]}/default/content/encryptedConfig`)
    .reply(200, ectyptedContent, {
      etag: exampleArrayFile.etag,
    });
}

export function mockConfigs(mock: MockAdapter, cdnUrls: string[]) {
  manifestMock(mock, cdnUrls);
  exampleSingletonMock(mock, cdnUrls);
  exampleArrayMock(mock, cdnUrls);
  encryptedConfigMock(mock, cdnUrls);
  exampleRetryMock(mock, cdnUrls);
}
