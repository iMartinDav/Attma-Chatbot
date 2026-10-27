/**
 * The data sources and compute the agent can connect to. This file is shared
 * by the server (which builds each connector's tools) and the Sources picker,
 * so it holds metadata only.
 */

export type ConnectorId =
  | 'phenotypes'
  | 'variants'
  | 'proteins'
  | 'literature'
  | 'pathways'
  | 'web'
  | 'python'
  | 'alphagenome'
  | 'documents';

export type ConnectorGroup = 'Knowledge' | 'Compute' | 'Models';

export interface Connector {
  id: ConnectorId;
  name: string;
  /** Who runs the source, shown under the name. */
  provider: string;
  description: string;
  group: ConnectorGroup;
  /** Environment variable the server needs before the connector can run. */
  requires?: string;
  /** Off unless the user turns it on. */
  optIn?: boolean;
}

export const CONNECTORS: Connector[] = [
  {
    id: 'phenotypes',
    name: 'Human Phenotype Ontology',
    provider: 'HPO · OMIM · Orphanet',
    description: 'Map findings to HPO and rank 12,900 rare diseases',
    group: 'Knowledge',
  },
  {
    id: 'variants',
    name: 'Ensembl VEP',
    provider: 'gnomAD · ClinVar · AlphaMissense · CADD',
    description: 'Annotate and prioritize variants',
    group: 'Knowledge',
  },
  {
    id: 'proteins',
    name: 'UniProt & AlphaFold DB',
    provider: 'EMBL-EBI · Google DeepMind',
    description: 'Protein function, domains and structure confidence',
    group: 'Knowledge',
  },
  {
    id: 'literature',
    name: 'PubMed',
    provider: 'NCBI',
    description: 'Search papers; Muse Spark reads and grades the evidence',
    group: 'Knowledge',
  },
  {
    id: 'pathways',
    name: 'Pathways & interactions',
    provider: 'g:Profiler (GO · Reactome · KEGG · WikiPathways) · STRING',
    description: 'Enrichment, pathways and protein networks',
    group: 'Knowledge',
  },
  {
    id: 'web',
    name: 'Web search',
    provider: 'Muse search grounding',
    description: 'Current protocols, tools and news, with citations',
    group: 'Knowledge',
  },
  {
    id: 'python',
    name: 'Python workspace',
    provider: 'Vercel Sandbox · scanpy · pysam · PyDESeq2',
    description: 'Run analyses on your files in an isolated microVM',
    group: 'Compute',
    requires: 'ATTMA_SANDBOX_SNAPSHOT',
  },
  {
    id: 'documents',
    name: 'Document reader',
    provider: 'Muse Spark vision',
    description: 'Read PDFs, reports and figures you attach',
    group: 'Models',
  },
  {
    id: 'alphagenome',
    name: 'AlphaGenome',
    provider: 'Google DeepMind',
    description: 'Predict regulatory and splicing effects of variants',
    group: 'Models',
    requires: 'ALPHAGENOME_API_KEY',
  },
];

export const CONNECTOR_IDS = CONNECTORS.map((c) => c.id);

export const DEFAULT_CONNECTORS = CONNECTORS.filter((c) => !c.optIn).map(
  (c) => c.id,
);
