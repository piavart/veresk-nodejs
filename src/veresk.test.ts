import { Veresk } from '.';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { AES } from 'crypto-js';
import {
  ENCRYPT_SECRET,
  exampleArrayFile,
  exampleRetryFile,
  exampleSingletonFile,
  manifest,
  mockConfigs,
} from './mocks/mock-data';

const cdnUrls = ['http://cdn.example.com'];

type TExampleArray = typeof exampleArrayFile.data;
type TExampleArrayItem = TExampleArray[number];

function createLog() {
  return {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('Veresk library', () => {
  let veresk: Veresk;
  let mock: MockAdapter;

  beforeAll(() => {
    mock = new MockAdapter(axios as any);
    mockConfigs(mock, cdnUrls);
  });

  beforeEach(async () => {
    veresk = new Veresk({
      cdnUrls,
      fetchRetryCount: 1,
      version: 'default',
      consumer: 'common',
      encryptSecret: ENCRYPT_SECRET,
      log: createLog(),
    });
    await veresk.init();
  });

  afterEach(() => {
    veresk.reset();
  });

  afterAll((done) => {
    mock.reset();
    done();
  });

  it('fetchManifest', async () => {
    const manifestInfo = await veresk.fetchManifest('common');

    expect(Array.isArray(manifestInfo.manifest)).toEqual(true);
    expect(manifestInfo.manifest.length).toEqual(manifest.data.length);
    expect(manifestInfo.etag).toEqual(manifest.etag);
  });

  it('getManifest', () => {
    const manifestInfo = veresk.getManifest('common');

    expect(Array.isArray(manifestInfo.manifest)).toEqual(true);
    expect(manifestInfo.manifest.length).toEqual(manifest.data.length);
    expect(manifestInfo.etag).toEqual(manifest.etag);
  });

  it('fetchContent: singleton', async () => {
    const exampleSingleton = await veresk.fetchContent<
      typeof exampleSingletonFile.data
    >('exampleSingleton');

    expect(exampleSingleton.exampleField).toEqual(
      exampleSingletonFile.data.exampleField,
    );
  });

  it('fetchContent: array', async () => {
    const exampleArray = await veresk.fetchContent<TExampleArray>(
      'exampleArray',
    );

    expect(Array.isArray(exampleArray)).toEqual(true);
    expect(exampleArray.length).toEqual(exampleArrayFile.data.length);
  });

  it('fetchContent: array with find', async () => {
    const person = await veresk.fetchContent<TExampleArrayItem>(
      'exampleArray',
      {
        find: { name: 'John Snow' },
      },
    );

    expect(Array.isArray(person)).toEqual(false);
    expect(person.name).toEqual('John Snow');
    expect(person.bastard).toEqual(true);
    expect(person.dwarf).toEqual(false);

    const person2 = await veresk.fetchContent<TExampleArrayItem>(
      'exampleArray',
      {
        find: { dwarf: true },
      },
    );

    expect(Array.isArray(person2)).toEqual(false);
    expect(person2.name).toEqual('Tyrion Lannister');
    expect(person2.bastard).toEqual(false);
    expect(person2.dwarf).toEqual(true);
  });

  it('fetchContent: array with find as function', async () => {
    const person = await veresk.fetchContent<TExampleArrayItem>(
      'exampleArray',
      {
        find: (item: TExampleArrayItem) =>
          item.name === 'Wrong Name' || item.name === 'Theon Greyjoy',
      },
    );

    expect(Array.isArray(person)).toEqual(false);
    expect(person.name).toEqual('Theon Greyjoy');
    expect(person.bastard).toEqual(false);
    expect(person.dwarf).toEqual(false);

    const person2 = await veresk.fetchContent<TExampleArrayItem>(
      'exampleArray',
      {
        find: (item: TExampleArrayItem) =>
          item.dwarf === false && item.bastard === false,
      },
    );

    expect(Array.isArray(person2)).toEqual(false);
    expect(person2.name).toEqual('Theon Greyjoy');
    expect(person2.bastard).toEqual(false);
    expect(person2.dwarf).toEqual(false);
  });

  it('fetchContent: array with filter', async () => {
    const persons = await veresk.fetchContent<TExampleArrayItem>(
      'exampleArray',
      {
        filter: { bastard: false },
      },
    );

    expect(Array.isArray(persons)).toEqual(true);
    expect(persons.length).toEqual(2);
    expect(persons[0].name).toEqual('Theon Greyjoy');
    expect(persons[0].bastard).toEqual(false);
    expect(persons[0].dwarf).toEqual(false);
  });

  it('fetchContent: array with filter and find', async () => {
    const person = await veresk.fetchContent<TExampleArrayItem>(
      'exampleArray',
      {
        filter: { bastard: false },
        find: { dwarf: false },
      },
    );

    expect(person).toBeTruthy();
    expect(Array.isArray(person)).toEqual(false);
    expect(person.name).toEqual('Theon Greyjoy');
    expect(person.bastard).toEqual(false);
    expect(person.dwarf).toEqual(false);
  });

  it('getContent: array', () => {
    const exampleArray = veresk.getContent<TExampleArray>('exampleArray');

    expect(Array.isArray(exampleArray)).toEqual(true);
    expect(exampleArray.length).toEqual(exampleArrayFile.data.length);
  });

  it('getAsList: find returns undefined when item does not exist', () => {
    const person = veresk.getAsList<TExampleArray>('exampleArray', {
      find: { name: 'Unexisted' },
    });

    expect(person).toBeUndefined();
  });

  it('getAsListOrThrow: find returns item', () => {
    const person = veresk.getAsListOrThrow<TExampleArray>('exampleArray', {
      find: { name: 'John Snow' },
    });

    expect(person.name).toEqual('John Snow');
    expect(person.bastard).toEqual(true);
  });

  it('getAsListOrThrow: find throws when item does not exist', () => {
    expect(() =>
      veresk.getAsListOrThrow<TExampleArray>('exampleArray', {
        find: { name: 'Unexisted' },
      }),
    ).toThrow(
      '(Veresk) could not find item in "exampleArray" with matcher {"name":"Unexisted"}',
    );
  });

  it('should not get files with not initialized params', () => {
    expect(() =>
      veresk.getAsList<TExampleArray>('exampleArray', {
        consumer: 'unexisted',
      }),
    ).toThrow('could not find file for default, unexisted');
  });

  it('getContent: encrypted file', () => {
    const exampleArray = veresk.getContent<TExampleArray>('encryptedConfig');

    expect(Array.isArray(exampleArray)).toEqual(true);
    expect(exampleArray.length).toEqual(exampleArrayFile.data.length);
  });

  it('getContent: freeze singleton', () => {
    const exampleSingleton =
      veresk.getContent<typeof exampleSingletonFile.data>('exampleSingleton');

    expect.assertions(1);

    try {
      exampleSingleton.deepField.name = 'newValue';
    } catch (e) {
      expect((e as Error).message).toEqual(
        "Cannot assign to read only property 'name' of object '#<Object>'",
      );
    }
  });

  it('getAsList: freeze array', () => {
    const exampleArray = veresk.getAsList<TExampleArray>('exampleArray');

    expect.assertions(1);

    try {
      exampleArray[0].name = 'newValue';
    } catch (e) {
      expect((e as Error).message).toEqual(
        "Cannot assign to read only property 'name' of object '#<Object>'",
      );
    }
  });
});

describe('Veresk library -> fetching with retry', () => {
  let veresk: Veresk;
  let mock: MockAdapter;
  const options = {
    cdnUrls,
    fetchRetryCount: 0,
    version: 'default',
    consumer: 'common',
    encryptSecret: ENCRYPT_SECRET,
    log: createLog(),
  };

  beforeEach(() => {
    mock = new MockAdapter(axios as any);
    mockConfigs(mock, cdnUrls);
  });

  afterEach(() => {
    veresk.reset();
    mock.reset();
  });

  afterAll((done) => {
    done();
  });

  it('fetchContent 0 retries', async () => {
    options.fetchRetryCount = 0;
    veresk = new Veresk(options);

    await expect(veresk.init()).rejects.toThrow(
      /Unhandled error\.\s*\(FetchFileError:/,
    );
    expect(mock.history.get).toHaveLength(5);
  });

  it('fetchContent 1 retry', async () => {
    options.fetchRetryCount = 1;
    veresk = new Veresk(options);
    await veresk.init();

    const exampleRetry =
      veresk.getContent<typeof exampleRetryFile.data>('exampleRetry');

    expect(exampleRetry.exampleField).toEqual(
      exampleRetryFile.data.exampleField,
    );
  });

  it('fetchContent 2 retries', async () => {
    options.fetchRetryCount = 2;
    veresk = new Veresk(options);
    await veresk.init();

    const exampleRetry =
      veresk.getContent<typeof exampleRetryFile.data>('exampleRetry');

    expect(exampleRetry.exampleField).toEqual(
      exampleRetryFile.data.exampleField,
    );
  });
});

describe('Veresk library -> manifest reconciliation', () => {
  let veresk: Veresk;
  let mock: MockAdapter;

  beforeEach(async () => {
    mock = new MockAdapter(axios as any);
    mockConfigs(mock, cdnUrls);
    veresk = new Veresk({
      cdnUrls,
      fetchRetryCount: 1,
      version: 'default',
      consumer: 'common',
      encryptSecret: ENCRYPT_SECRET,
      log: createLog(),
    });
    await veresk.init();
  });

  afterEach(() => {
    veresk.reset();
    mock.reset();
  });

  it('removes files that disappeared from manifest after update', async () => {
    const nextManifest = {
      etag: 'etagManifestV2',
      data: manifest.data.filter((file) => file.name !== 'exampleArray'),
    };

    expect(veresk.getAsList<TExampleArray>('exampleArray')).toHaveLength(
      exampleArrayFile.data.length,
    );

    mock.resetHandlers();
    mock
      .onGet(`${cdnUrls[0]}/default/manifests/common`)
      .reply(200, nextManifest.data, {
        etag: nextManifest.etag,
      });
    mock
      .onGet(`${cdnUrls[0]}/default/content/exampleRetry`)
      .reply(200, exampleRetryFile.data, {
        etag: exampleRetryFile.etag,
      });
    mock
      .onGet(`${cdnUrls[0]}/default/content/encryptedConfig`)
      .reply(
        200,
        AES.encrypt(
          JSON.stringify(exampleArrayFile.data),
          ENCRYPT_SECRET,
        ).toString(),
        {
          etag: exampleArrayFile.etag,
        },
      );

    await (veresk as any).update();

    expect(() => veresk.getAsList<TExampleArray>('exampleArray')).toThrow(
      'Unexpected file with name exampleArray',
    );

    const manifestInfo = veresk.getManifest('common');
    expect(manifestInfo.etag).toEqual(nextManifest.etag);
    expect(
      manifestInfo.manifest.find((file) => file.name === 'exampleArray'),
    ).toBeUndefined();
  });
});
