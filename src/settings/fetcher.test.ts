import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Fetcher } from './fetcher';

describe('Fetcher', () => {
  let mock: any;

  beforeEach(() => {
    mock = new MockAdapter(axios as any);
  });

  afterEach(() => {
    mock.reset();
  });

  it('does not retry when fetchRetryCount is 0', async () => {
    const fetcher = new Fetcher(['http://cdn.example.com'], 100, 0);
    const url = 'http://cdn.example.com/default/content/example';

    mock.onGet(url).replyOnce(500).onGet(url).reply(200, { ok: true }, {
      etag: 'etagExample',
    });

    await expect(fetcher.fetchSetting('/default/content/example')).rejects.toThrow(
      `Fetch setting error: ${url}`,
    );
    expect(mock.history.get).toHaveLength(1);
  });

  it('retries exactly fetchRetryCount additional times', async () => {
    const fetcher = new Fetcher(['http://cdn.example.com'], 100, 2);
    const url = 'http://cdn.example.com/default/content/example';

    mock
      .onGet(url)
      .replyOnce(500)
      .onGet(url)
      .replyOnce(500)
      .onGet(url)
      .reply(200, { ok: true }, { etag: 'etagExample' });

    const result = await fetcher.fetchSetting('/default/content/example');

    expect(result.data).toEqual({ ok: true });
    expect(mock.history.get).toHaveLength(3);
  });

  it('switches to the next CDN url on retry and keeps using it after success', async () => {
    const fetcher = new Fetcher(
      ['http://cdn-1.example.com', 'http://cdn-2.example.com'],
      100,
      1,
    );
    const firstUrl = 'http://cdn-1.example.com/default/content/example';
    const secondUrl = 'http://cdn-2.example.com/default/content/example';
    const nextSecondUrl = 'http://cdn-2.example.com/default/content/next';

    mock.onGet(firstUrl).reply(500);
    mock.onGet(secondUrl).reply(200, { ok: true }, { etag: 'etagExample' });

    const result = await fetcher.fetchSetting('/default/content/example');

    expect(result.url).toEqual(secondUrl);
    expect(mock.history.get.map((request: any) => request.url)).toEqual([
      firstUrl,
      secondUrl,
    ]);

    mock.resetHistory();
    mock.onGet(nextSecondUrl).reply(200, { next: true }, { etag: 'etagNext' });

    const nextResult = await fetcher.fetchSetting('/default/content/next');

    expect(nextResult.url).toEqual(nextSecondUrl);
    expect(mock.history.get.map((request: any) => request.url)).toEqual([
      nextSecondUrl,
    ]);
  });
});
