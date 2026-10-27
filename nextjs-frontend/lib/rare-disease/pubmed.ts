/**
 * Minimal PubMed client for the literature sub-agent: E-utilities esearch for
 * IDs, then efetch XML for titles, abstracts and years.
 */

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

export interface PubMedArticle {
  pmid: string;
  title: string;
  journal: string;
  year: string;
  abstract: string;
  url: string;
}

// NCBI allows 3 requests/s without an API key (10 with one). Requests share
// one queue spaced to stay under the limit, and a 429 is retried with backoff.
const MIN_INTERVAL_MS = process.env.PUBMED_API_KEY ? 110 : 350;
let queue: Promise<unknown> = Promise.resolve();

function throttledFetch(url: string, timeoutMs: number): Promise<Response> {
  const run = async () => {
    for (let attempt = 1; ; attempt++) {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status !== 429 || attempt === 4) return response;
      await sleep(1000 * attempt);
    }
  };
  const result = queue.then(run);
  queue = result.catch(() => undefined).then(() => sleep(MIN_INTERVAL_MS));
  return result;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function apiKeyParam() {
  const key = process.env.PUBMED_API_KEY;
  return key ? `&api_key=${key}` : '';
}

function decode(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function first(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? decode(match[1]) : '';
}

export async function searchPubMed(
  query: string,
  limit: number,
): Promise<PubMedArticle[]> {
  const search = await throttledFetch(
    `${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&sort=relevance&retmax=${limit}&term=${encodeURIComponent(query)}${apiKeyParam()}`,
    15_000,
  );
  if (!search.ok) throw new Error(`PubMed search returned ${search.status}`);
  const ids: string[] = (await search.json()).esearchresult?.idlist ?? [];
  if (ids.length === 0) return [];

  const fetched = await throttledFetch(
    `${EUTILS}/efetch.fcgi?db=pubmed&retmode=xml&id=${ids.join(',')}${apiKeyParam()}`,
    20_000,
  );
  if (!fetched.ok) throw new Error(`PubMed fetch returned ${fetched.status}`);
  const xml = await fetched.text();

  return xml
    .split('<PubmedArticle>')
    .slice(1)
    .map((article) => {
      const pmid = first(article, 'PMID');
      const abstract = [
        ...article.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g),
      ]
        .map((m) => decode(m[1]))
        .join(' ');
      const pubDate =
        article.match(/<PubDate>([\s\S]*?)<\/PubDate>/)?.[1] ?? '';
      return {
        pmid,
        title: first(article, 'ArticleTitle'),
        journal: first(article, 'ISOAbbreviation') || first(article, 'Title'),
        year:
          first(pubDate, 'Year') || first(pubDate, 'MedlineDate').slice(0, 4),
        abstract,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      };
    })
    .filter((a) => a.pmid);
}
