/**
 * Protein context: UniProt (reviewed entry, function, domains and other
 * positional features) and the AlphaFold DB model and its confidence. Given a
 * residue, it reports which features the residue falls in, which is what a
 * missense variant interpretation needs (ACMG PM1: mutational hot spot or
 * well-established functional domain).
 */

import { tool } from 'ai';
import { z } from 'zod';

const UNIPROT = 'https://rest.uniprot.org/uniprotkb';
const ALPHAFOLD = 'https://alphafold.ebi.ac.uk/api/prediction';
const FEATURE_TYPES = new Set([
  'Domain',
  'Region',
  'Repeat',
  'Transmembrane',
  'Topological domain',
  'Intramembrane',
  'Active site',
  'Binding site',
  'Site',
  'Motif',
  'Zinc finger',
  'DNA binding',
  'Disulfide bond',
  'Modified residue',
]);

interface UniProtFeature {
  type: string;
  description?: string;
  location: { start: { value: number }; end: { value: number } };
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json() as Promise<T>;
}

export async function proteinContext(gene: string, residue?: number) {
  const started = Date.now();
  const search = await getJson<{
    results: {
      primaryAccession: string;
      proteinDescription?: {
        recommendedName?: { fullName?: { value: string } };
      };
      sequence?: { length: number };
      comments?: { commentType: string; texts?: { value: string }[] }[];
      features?: UniProtFeature[];
    }[];
  }>(
    `${UNIPROT}/search?query=${encodeURIComponent(
      `gene_exact:${gene} AND organism_id:9606 AND reviewed:true`,
    )}&fields=accession,protein_name,length,cc_function,ft_domain,ft_region,ft_repeat,ft_transmem,ft_topo_dom,ft_intramem,ft_act_site,ft_binding,ft_site,ft_motif,ft_zn_fing,ft_dna_bind&format=json&size=1`,
  );
  const entry = search.results[0];
  if (!entry) throw new Error(`No reviewed human UniProt entry for ${gene}.`);
  const accession = entry.primaryAccession;

  const features = (entry.features ?? [])
    .filter((f) => FEATURE_TYPES.has(f.type))
    .map((f) => ({
      type: f.type,
      description: f.description ?? '',
      start: f.location.start.value,
      end: f.location.end.value,
    }));

  const [model] = await getJson<
    {
      entryId: string;
      globalMetricValue: number;
      fractionPlddtVeryHigh: number;
      fractionPlddtConfident: number;
      fractionPlddtLow: number;
      fractionPlddtVeryLow: number;
      latestVersion: number;
    }[]
  >(`${ALPHAFOLD}/${accession}`).catch(() => []);

  return {
    gene,
    accession,
    protein: entry.proteinDescription?.recommendedName?.fullName?.value ?? gene,
    length: entry.sequence?.length,
    function: entry.comments
      ?.find((c) => c.commentType === 'FUNCTION')
      ?.texts?.[0]?.value.slice(0, 600),
    residue,
    residueFeatures:
      residue === undefined
        ? []
        : features.filter((f) => f.start <= residue && residue <= f.end),
    domains: features
      .filter((f) => f.type === 'Domain' || f.type === 'Repeat')
      .slice(0, 12),
    structure: model
      ? {
          modelId: model.entryId,
          version: model.latestVersion,
          meanPlddt: model.globalMetricValue,
          fractionConfident:
            model.fractionPlddtVeryHigh + model.fractionPlddtConfident,
          url: `https://alphafold.ebi.ac.uk/entry/${accession}`,
        }
      : null,
    uniprotUrl: `https://www.uniprot.org/uniprotkb/${accession}/entry`,
    elapsedMs: Date.now() - started,
  };
}

export const proteinStructureTool = tool({
  description: `Protein context for a human gene from UniProt and the AlphaFold Protein Structure Database: function, domains and other positional features, and AlphaFold model confidence (pLDDT). Pass a residue number (e.g. 1648 for p.Arg1648His) to see which domain, transmembrane segment, site or region a missense variant falls in.`,
  inputSchema: z.object({
    gene: z.string().describe('HGNC gene symbol, e.g. SCN1A'),
    residue: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Protein position of a missense variant'),
  }),
  execute: ({ gene, residue }) => proteinContext(gene, residue),
});
