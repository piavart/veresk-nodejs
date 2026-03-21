import { Veresk } from '.';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { AES } from 'crypto-js';
import {
  exampleArraySetting,
  exampleRetrySetting,
  exampleSingletonSetting,
  manifest,
} from './mocks/mock-data';
import { SettingType } from './interfaces';
import { mockConfigs, ENCRYPT_SECRET } from './mocks/mock-data';

const cdnUrls = ['http://cdn.example.com'];

describe('Veresk library', () => {
  let veresk: Veresk;
  let mock: any;

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

  it('getManifest', async () => {
    const manifestInfo = veresk.getManifest('common');
    expect(Array.isArray(manifestInfo.manifest)).toEqual(true);
    expect(manifestInfo.manifest.length).toEqual(manifest.data.length);
    expect(manifestInfo.etag).toEqual(manifest.etag);
  });

  it('fetchSetting: singleton', async () => {
    const exampleSingleton = await veresk.fetchSetting<
      typeof exampleSingletonSetting.data
    >('exampleSingleton', { type: SettingType.Singleton });
    expect(exampleSingleton.exampleField).toEqual(
      exampleSingletonSetting.data.exampleField,
    );
  });

  it('fetchSetting: array', async () => {
    const exampleArray = await veresk.fetchSetting<
      typeof exampleArraySetting.data[0]
    >('exampleArray');

    expect(Array.isArray(exampleArray)).toEqual(true);
    expect(exampleArray.length).toEqual(exampleArraySetting.data.length);
  });

  it('fetchSetting: array with type', async () => {
    const exampleArray = await veresk.fetchSetting<
      typeof exampleArraySetting.data[0]
    >('exampleArray', { type: SettingType.List });

    expect(Array.isArray(exampleArray)).toEqual(true);
    expect(exampleArray.length).toEqual(exampleArraySetting.data.length);
  });

  it('fetchSetting: array with find', async () => {
    const person = await veresk.fetchSetting<
      typeof exampleArraySetting.data[0]
    >('exampleArray', {
      find: { name: 'John Snow' },
    });
    expect(Array.isArray(person)).toEqual(false);
    expect(person.name).toEqual('John Snow');
    expect(person.bastard).toEqual(true);
    expect(person.dwarf).toEqual(false);

    const person2 = await veresk.fetchSetting<
      typeof exampleArraySetting.data[0]
    >('exampleArray', {
      find: { dwarf: true },
    });
    expect(Array.isArray(person2)).toEqual(false);
    expect(person2.name).toEqual('Tyrion Lannister');
    expect(person2.bastard).toEqual(false);
    expect(person2.dwarf).toEqual(true);
  });

  it('fetchSetting: array with find as function', async () => {
    const person = await veresk.fetchSetting<
      typeof exampleArraySetting.data[0]
    >('exampleArray', {
      find: ((item: typeof exampleArraySetting.data[0]) => {
        return item.name === 'Wrong Name' || item.name === 'Theon Greyjoy';
      }) as (item: typeof exampleArraySetting.data[0]) => boolean,
    });
    expect(Array.isArray(person)).toEqual(false);
    expect(person.name).toEqual('Theon Greyjoy');
    expect(person.bastard).toEqual(false);
    expect(person.dwarf).toEqual(false);

    const person2 = await veresk.fetchSetting<
      typeof exampleArraySetting.data[0]
    >('exampleArray', {
      find: ((item: typeof exampleArraySetting.data[0]) => {
        return item.dwarf === false && item.bastard === false;
      }) as (item: typeof exampleArraySetting.data[0]) => boolean,
    });
    expect(Array.isArray(person2)).toEqual(false);
    expect(person2.name).toEqual('Theon Greyjoy');
    expect(person2.bastard).toEqual(false);
    expect(person2.dwarf).toEqual(false);
  });

  it('fetchSetting: array with filter', async () => {
    const persons = await veresk.fetchSetting<
      typeof exampleArraySetting.data[0]
    >('exampleArray', {
      filter: { bastard: false },
    });
    expect(Array.isArray(persons)).toEqual(true);
    expect(persons.length).toEqual(2);
    expect(persons[0].name).toEqual('Theon Greyjoy');
    expect(persons[0].bastard).toEqual(false);
    expect(persons[0].dwarf).toEqual(false);
  });

  it('fetchSetting: array with filter and find', async () => {
    const person = await veresk.fetchSetting<
      typeof exampleArraySetting.data[0]
    >('exampleArray', {
      filter: { bastard: false },
      find: { dwarf: false },
    });
    expect(person).toBeTruthy();
    expect(Array.isArray(person)).toEqual(false);
    expect(person?.name).toEqual('Theon Greyjoy');
    expect(person?.bastard).toEqual(false);
    expect(person?.dwarf).toEqual(false);
  });

  it('getSetting: array', async () => {
    const exampleArray =
      veresk.getSetting<typeof exampleArraySetting.data[0]>('exampleArray');

    expect(Array.isArray(exampleArray)).toEqual(true);
    expect(exampleArray.length).toEqual(exampleArraySetting.data.length);
  });

  it('getSetting: find', async () => {
    expect.assertions(1);

    try {
      veresk.getSetting('exampleArray', {
        find: { name: 'Unexisted' },
      });
    } catch (err) {
      expect(
        (err as Error).message.startsWith(
          'could not find setting exampleArray with find params',
        ),
      ).toBeTruthy();
    }
  });

  it('chould not get settings from with not initialized params', async () => {
    expect.assertions(1);
    try {
      veresk.getSetting('exampleArray', { consumer: 'unexisted' });
    } catch (err) {
      expect((err as Error).message).toEqual(
        'could not find setting for default, unexisted',
      );
    }
  });

  it('fetchSetting: encrypted setting', async () => {
    const exampleArray =
      veresk.getSetting<typeof exampleArraySetting.data[0]>(
        'encryptedConfig',
      );

    expect(Array.isArray(exampleArray)).toEqual(true);
    expect(exampleArray.length).toEqual(exampleArraySetting.data.length);
  });

  it('fetchSetting: freeze singleton', async () => {
    const exampleSingleton = veresk.getSetting<
      typeof exampleSingletonSetting.data
    >('exampleSingleton', { type: SettingType.Singleton });

    expect.assertions(1);
    try {
      exampleSingleton.deepField.name = 'newValue';
    } catch (e) {
      expect((e as Error).message).toEqual(
        "Cannot assign to read only property 'name' of object '#<Object>'",
      );
    }
  });

  it('fetchSetting: freeze array', async () => {
    const exampleArray =
      veresk.getSetting<typeof exampleArraySetting.data[0]>('exampleArray');

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
  let mock: any;
  const options = {
    cdnUrls,
    fetchRetryCount: 0,
    version: 'default',
    consumer: 'common',
    encryptSecret: ENCRYPT_SECRET,
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

  it('fetchSetting 0 retries', async () => {
    options.fetchRetryCount = 0;
    veresk = new Veresk(options);

    await expect(veresk.init()).rejects.toThrow(
      /Unhandled error\.\s*\(FetchSettingError:/,
    );
    expect(mock.history.get).toHaveLength(5);
  });

  it('fetchSetting 1 retry', async () => {
    options.fetchRetryCount = 1;
    veresk = new Veresk(options);
    await veresk.init();
    const exampleRetry = await veresk.fetchSetting<
      typeof exampleRetrySetting.data
    >('exampleRetry', { type: SettingType.Singleton });
    expect(exampleRetry.exampleField).toEqual(
      exampleRetrySetting.data.exampleField,
    );
  });

  it('fetchSetting 2 retries', async () => {
    options.fetchRetryCount = 2;
    veresk = new Veresk(options);
    await veresk.init();
    const exampleRetry = await veresk.fetchSetting<
      typeof exampleRetrySetting.data
    >('exampleRetry', { type: SettingType.Singleton });
    expect(exampleRetry.exampleField).toEqual(
      exampleRetrySetting.data.exampleField,
    );
  });
});

describe('Veresk library -> manifest reconciliation', () => {
  let veresk: Veresk;
  let mock: any;

  beforeEach(async () => {
    mock = new MockAdapter(axios as any);
    mockConfigs(mock, cdnUrls);
    veresk = new Veresk({
      cdnUrls,
      fetchRetryCount: 1,
      version: 'default',
      consumer: 'common',
      encryptSecret: ENCRYPT_SECRET,
    });
    await veresk.init();
  });

  afterEach(() => {
    veresk.reset();
    mock.reset();
  });

  it('removes settings that disappeared from manifest after update', async () => {
    const nextManifest = {
      etag: 'etagManifestV2',
      data: manifest.data.filter((setting) => setting.name !== 'exampleArray'),
    };

    expect(
      veresk.getSetting<typeof exampleArraySetting.data[0]>('exampleArray'),
    ).toHaveLength(exampleArraySetting.data.length);

    mock.resetHandlers();
    mock
      .onGet(`${cdnUrls[0]}/default/manifests/common`)
      .reply(200, nextManifest.data, {
        etag: nextManifest.etag,
      });
    mock
      .onGet(`${cdnUrls[0]}/default/content/exampleRetry`)
      .reply(200, exampleRetrySetting.data, {
        etag: exampleRetrySetting.etag,
      });
    mock
      .onGet(`${cdnUrls[0]}/default/content/encryptedConfig`)
      .reply(
        200,
        AES.encrypt(
          JSON.stringify(exampleArraySetting.data),
          ENCRYPT_SECRET,
        ).toString(),
        {
          etag: exampleArraySetting.etag,
        },
      );

    await (veresk as any).update();

    expect(() =>
      veresk.getSetting<typeof exampleArraySetting.data[0]>('exampleArray'),
    ).toThrow('Unexpected setting with name exampleArray');

    const manifestInfo = veresk.getManifest('common');
    expect(manifestInfo.etag).toEqual(nextManifest.etag);
    expect(
      manifestInfo.manifest.find((setting) => setting.name === 'exampleArray'),
    ).toBeUndefined();
  });
});
