// The sandbox may only reach the public data APIs the tools promise; everything else is denied by default.
// Hosts were confirmed in the published packages (alphagenome 0.10.0, scanpy 1.12.5), not guessed from product names.
export const SANDBOX_DATA_HOSTS = [
  'gdmscience.googleapis.com', // AlphaGenome gRPC API (dna_client default address)
  'rest.ensembl.org', // Ensembl REST and VEP annotation
  'rest.uniprot.org', // UniProt protein records
  'eutils.ncbi.nlm.nih.gov', // NCBI E-utilities (PubMed)
  'exampledata.scverse.org', // scanpy example datasets such as pbmc3k
] as const;

/**
 * This app's own public Blob host. Every Vercel Blob store shares the
 * *.public.blob.vercel-storage.com suffix, so a wildcard would let code reach
 * any store; the store id inside the read-write token
 * (vercel_blob_rw_<storeId>_<secret>) names ours exactly.
 */
export function blobStoreHost(
  token = process.env.BLOB_READ_WRITE_TOKEN,
): string | null {
  const storeId = token?.match(/^vercel_blob_rw_([A-Za-z0-9]+)_/)?.[1];
  return storeId
    ? `${storeId.toLowerCase()}.public.blob.vercel-storage.com`
    : null;
}

/** The full allow-list: the data APIs plus this app's Blob store, so attached files can be staged. */
export function sandboxAllowedHosts(): string[] {
  const blobHost = blobStoreHost();
  return blobHost ? [...SANDBOX_DATA_HOSTS, blobHost] : [...SANDBOX_DATA_HOSTS];
}
