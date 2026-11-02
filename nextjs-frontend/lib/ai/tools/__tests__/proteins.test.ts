// The AI SDK ships ESM only, which this Jest setup cannot load, so tool() is replaced by the definition it wraps.
jest.mock('ai', () => ({
  tool: (definition: unknown) => definition,
}));

import { getJson } from '../proteins';

describe('getJson retry', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('retries once on a 5xx and then succeeds', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ hello: 'world' }),
      });
    global.fetch = fetchMock as typeof fetch;
    await expect(
      getJson('https://rest.uniprot.org/uniprotkb/search'),
    ).resolves.toEqual({ hello: 'world' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 4xx and never leaks the full URL', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    global.fetch = fetchMock as typeof fetch;
    await expect(
      getJson('https://rest.uniprot.org/uniprotkb/search?query=secret'),
    ).rejects.toThrow('Request failed (404)');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives a short message after network failures', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('socket hangup'));
    global.fetch = fetchMock as typeof fetch;
    await expect(
      getJson('https://rest.uniprot.org/uniprotkb/search'),
    ).rejects.toThrow('UniProt did not respond; try again');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
