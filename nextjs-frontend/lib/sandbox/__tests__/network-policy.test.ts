import {
  blobStoreHost,
  sandboxAllowedHosts,
  SANDBOX_DATA_HOSTS,
} from '../network-policy';

describe('sandbox network allow-list', () => {
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
  afterEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = originalToken;
  });

  it('includes the data APIs the tools call', () => {
    expect(SANDBOX_DATA_HOSTS).toContain('gdmscience.googleapis.com');
    expect(SANDBOX_DATA_HOSTS).toContain('rest.ensembl.org');
    expect(SANDBOX_DATA_HOSTS).toContain('rest.uniprot.org');
    expect(SANDBOX_DATA_HOSTS).toContain('exampledata.scverse.org');
  });

  it('does not list hosts the packages never call', () => {
    // The AlphaGenome client dials gdmscience.googleapis.com; this name only looks right.
    expect(SANDBOX_DATA_HOSTS).not.toContain('alphagenome.googleapis.com');
    expect(SANDBOX_DATA_HOSTS).not.toContain('ndownloader.figshare.com');
  });

  it('pins Blob to this app store and contains no wildcard', () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_AbC123_secretpart';
    const hosts = sandboxAllowedHosts();
    expect(hosts).toContain('abc123.public.blob.vercel-storage.com');
    for (const host of hosts) expect(host).not.toContain('*');
  });

  it('leaves Blob out when the token is missing or malformed', () => {
    expect(blobStoreHost('')).toBeNull();
    expect(blobStoreHost('not-a-blob-token')).toBeNull();
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect(sandboxAllowedHosts()).toEqual([...SANDBOX_DATA_HOSTS]);
  });
});
