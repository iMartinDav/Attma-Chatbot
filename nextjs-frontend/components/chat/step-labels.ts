/**
 * Pure step labels for the agent timeline, kept apart from the React tree so
 * they can be tested without loading the AI Elements components.
 */

/** Minimal message shape needed to locate an analysis part, without depending on the AI SDK types. */
export interface MessageWithParts {
  id: string;
  parts?: ReadonlyArray<{ type: string }> | null;
}

/**
 * Id of the last message carrying a `data-analysis` part, or null when none does.
 * Only that message may offer review actions, so stale cards stay read-only.
 */
export function lastAnalysisMessageId(
  messages: ReadonlyArray<MessageWithParts>,
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.parts?.some((part) => part.type === 'data-analysis')) {
      return message.id;
    }
  }
  return null;
}

export interface StepPart {
  type: string;
  text?: string;
  state?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorText?: string;
  count?: number;
}

const VERDICT_WORDS: Record<string, string> = {
  strong: 'strong evidence',
  moderate: 'moderate evidence',
  limited: 'limited evidence',
  none: 'no supporting evidence',
};

function formatFactValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  return String(value);
}

/** Problems listed under a refused report step, so a reviewer sees why the gate held. */
export function refusalProblemsOf(part: StepPart): string[] {
  const output = part.output ?? {};
  const problems = (output as { problems?: unknown }).problems;
  if (!Array.isArray(problems)) return [];
  return problems.filter((entry): entry is string => typeof entry === 'string');
}

export function describeStep(part: StepPart): string {
  const name = part.type.replace('tool-', '');
  const input = part.input ?? {};
  const output = part.output ?? {};
  const done = part.state === 'output-available';
  const refused = (output as { ok?: unknown }).ok === false;
  switch (name) {
    case 'setChecklist': {
      if (refused) return 'Checklist refused';
      const checklist = (output as { checklist?: unknown[] }).checklist;
      const items = (input as { items?: unknown[] }).items;
      const count = checklist?.length ?? items?.length ?? 0;
      return count > 0
        ? `Set a checklist of ${count} questions`
        : 'Setting a checklist';
    }
    case 'recordFact': {
      const count = part.count;
      if (count && count > 1) return `Recorded ${count} facts`;
      if (refused) return 'Fact refused';
      const fact = (output as { fact?: Record<string, unknown> }).fact;
      const path = String(fact?.path ?? input.path ?? '');
      const value = fact?.value ?? input.value;
      const item = String(fact?.itemId ?? input.itemId ?? '');
      return `Recorded ${path} = ${formatFactValue(value)} for ${item}`;
    }
    case 'submitReport': {
      if (refused) {
        const left = (output as { refusalsLeft?: unknown }).refusalsLeft;
        const k =
          typeof left === 'number' ? Math.min(3, Math.max(1, 3 - left)) : 1;
        return `Report refused (${k} of 3)`;
      }
      if (done && (output as { ok?: unknown }).ok === true) {
        return 'Report checked: passed';
      }
      return 'Checking the report';
    }
    case 'checkVariantInput': {
      const qc = (output as { qc?: { status?: unknown; total?: unknown } }).qc;
      if (qc?.status === 'fail') return 'Variant input QC: failed';
      if (qc?.status === 'warn')
        return 'Variant input QC: passed with warnings';
      return done ? 'Variant input QC: passed' : 'Checking variant input';
    }
    case 'requestInput': {
      if (refused) return 'Input request refused';
      const request = (output as { request?: { question?: unknown } }).request;
      const missing = String(
        request?.question ?? input.missing ?? input.question ?? '',
      );
      return missing ? `Asked for: ${missing}` : 'Asked for input';
    }
    case 'readClinicalDocument':
      return done
        ? `Read ${output.documentType ?? 'document'}: ${(output.presentFindings as unknown[])?.length ?? 0} findings, ${(output.variants as unknown[])?.length ?? 0} variants`
        : `Reading ${input.name ?? 'the document'} with Muse Spark`;
    case 'rankDiagnoses': {
      const top = (output.diseases as { name: string }[] | undefined)?.[0]
        ?.name;
      const variants = (input.variants as unknown[] | undefined)?.length;
      return done
        ? `Ranked 12,900 diseases${variants ? ` and ${variants} variants` : ''}: ${top ?? 'no match'} first`
        : `Ranking diseases${variants ? ' and variants' : ''}`;
    }
    case 'prioritizeVariants':
      return done
        ? `Prioritized ${(output.variants as unknown[])?.length ?? 0} variants`
        : 'Annotating variants';
    case 'reviewLiterature':
      return done
        ? `Reviewed PubMed for ${output.gene}: ${VERDICT_WORDS[output.verdict as string] ?? 'reviewed'}`
        : `Reviewing PubMed for ${input.gene ?? 'the gene'}`;
    case 'runPython':
      return done
        ? `Ran “${input.title ?? 'Python'}” in the sandbox${(output.files as unknown[])?.length ? `: ${(output.files as unknown[]).length} files` : ''}${output.exitCode ? ` (exit ${output.exitCode})` : ''}`
        : `Running “${input.title ?? 'Python'}” in the sandbox`;
    case 'proteinStructure':
      return done
        ? `Mapped ${input.gene}${input.residue ? ` residue ${input.residue}` : ''} on UniProt and AlphaFold DB`
        : `Looking up ${input.gene ?? 'the protein'} in UniProt and AlphaFold DB`;
    case 'predictVariantEffect':
      return done
        ? `AlphaGenome scored ${output.variant ?? 'the variant'}`
        : 'Scoring the variant with AlphaGenome';
    case 'readDocument':
      return done
        ? 'Read the document with Muse Spark'
        : 'Reading the document with Muse Spark';
    case 'web_search': {
      const count = part.count;
      const lookups = count ? ` (${count} lookups)` : '';
      return done
        ? `Searched the web${lookups}`
        : `Searching the web${lookups}`;
    }
    case 'searchPubMed':
      return `Searched PubMed${input.query ? ` for “${input.query}”` : ''}`;
    case 'enrichGenes':
      return done
        ? `Enrichment of ${(input.genes as unknown[])?.length ?? 0} genes (g:Profiler): ${output.significant ?? 0} significant terms`
        : `Testing ${(input.genes as unknown[])?.length ?? 0} genes for enrichment (g:Profiler)`;
    case 'searchReactome':
      return `Searched Reactome${input.query ? ` for “${input.query}”` : ''}`;
    case 'stringInteractions':
      return 'Queried STRING for protein interactions';
    case 'lookupGene':
      return `Looked up ${input.geneSymbol ?? 'the gene'}`;
    default:
      // camelCase to words, keeping acronyms whole: enrichGO -> Enrich GO
      return name
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, (c) => c.toUpperCase());
  }
}

/** Who ran a step: a Muse model, the Python sandbox, or a data source. */
export function runnerOf(part: StepPart): { label: string; muse: boolean } {
  const name = part.type.replace('tool-', '');
  // The gate tools run in code; only the claims check inside submitReport calls Muse Spark.
  if (name === 'submitReport') {
    return { label: 'Code + Muse Spark', muse: true };
  }
  if (
    name === 'setChecklist' ||
    name === 'recordFact' ||
    name === 'checkVariantInput' ||
    name === 'requestInput'
  ) {
    return { label: 'Attma checks', muse: false };
  }
  const MUSE: Record<string, string> = {
    readClinicalDocument: 'Muse Spark',
    readDocument: 'Muse Spark',
    reviewLiterature: 'Muse Spark',
    web_search: 'Muse search',
  };
  const SOURCES: Record<string, string> = {
    runPython: 'Python sandbox',
    rankDiagnoses: 'HPO',
    prioritizeVariants: 'Ensembl VEP',
    proteinStructure: 'UniProt · AlphaFold',
    predictVariantEffect: 'AlphaGenome',
    enrichGenes: 'g:Profiler',
    enrichGO: 'PANTHER',
    searchPubMed: 'PubMed',
    searchReactome: 'Reactome',
    searchKEGG: 'KEGG',
    stringInteractions: 'STRING',
    lookupGene: 'MyGene',
  };
  if (name === 'createDocument') {
    return part.input?.kind === 'image'
      ? { label: 'Muse Image', muse: true }
      : { label: 'Muse Wonder', muse: true };
  }
  if (MUSE[name]) return { label: MUSE[name], muse: true };
  return { label: SOURCES[name] ?? 'Tool', muse: false };
}
