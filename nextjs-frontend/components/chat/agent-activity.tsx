'use client';

/**
 * Agent activity built from AI Elements: the model's reasoning, a timeline of
 * the steps the agent took, generic tool calls, and the papers it cited.
 */

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning';
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources';
import {
  Task,
  TaskContent,
  TaskItem,
  TaskTrigger,
} from '@/components/ai-elements/task';
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  type ToolPart,
  ToolOutput,
} from '@/components/ai-elements/tool';
import { cn } from '@/lib/utils';
import { CheckIcon, CircleAlertIcon, LoaderIcon } from 'lucide-react';

interface AnyPart {
  type: string;
  text?: string;
  state?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorText?: string;
}

export function MessageReasoning({
  parts,
  isStreaming,
}: {
  parts: AnyPart[];
  isStreaming: boolean;
}) {
  const text = parts
    .filter((p) => p.type === 'reasoning' && p.text)
    .map((p) => p.text)
    .join('\n\n');
  if (!text) return null;
  return (
    <Reasoning
      className="w-full"
      isStreaming={isStreaming && parts.at(-1)?.type === 'reasoning'}
      defaultOpen={false}
    >
      <ReasoningTrigger />
      <ReasoningContent>{text}</ReasoningContent>
    </Reasoning>
  );
}

const toolParts = (parts: AnyPart[]) =>
  parts.filter((p) => p.type.startsWith('tool-'));

const VERDICT_WORDS: Record<string, string> = {
  strong: 'strong evidence',
  moderate: 'moderate evidence',
  limited: 'limited evidence',
  none: 'no supporting evidence',
};

function describeStep(part: AnyPart): string {
  const name = part.type.replace('tool-', '');
  const input = part.input ?? {};
  const output = part.output ?? {};
  const done = part.state === 'output-available';
  switch (name) {
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
      const count = (part as AnyPart & { count?: number }).count;
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

function StepIcon({ state }: { state?: string }) {
  if (state === 'output-available') {
    return (
      <CheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
    );
  }
  if (state === 'output-error') {
    return <CircleAlertIcon className="size-3.5 text-destructive" />;
  }
  return <LoaderIcon className="size-3.5 animate-spin text-muted-foreground" />;
}

/** Who ran a step: a Muse model, the Python sandbox, or a data source. */
function runnerOf(part: AnyPart): { label: string; muse: boolean } {
  const name = part.type.replace('tool-', '');
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

interface RunSummary {
  model: string;
  durationMs: number;
  toolCalls: number;
  totalTokens?: number;
}

const formatDuration = (ms: number) => {
  const seconds = Math.round(ms / 1000);
  return seconds < 60
    ? `${seconds} s`
    : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
};

/**
 * A timeline of the agent's tool steps, each labelled with what ran it, and
 * once the run ends, the orchestrating model, step count and time.
 */
export function AgentSteps({
  parts,
  isStreaming,
}: {
  parts: AnyPart[];
  isStreaming?: boolean;
}) {
  // Muse search grounding reports each search and page it opens as its own
  // call; consecutive ones read better as one row.
  const steps = toolParts(parts).reduce<(AnyPart & { count?: number })[]>(
    (rows, part) => {
      const last = rows.at(-1);
      if (part.type === 'tool-web_search' && last?.type === 'tool-web_search') {
        rows[rows.length - 1] = {
          ...part,
          // Done once any lookup returned; searches that fail mid-run are
          // retried by Muse and do not fail the group.
          state:
            last.state === 'output-available' ||
            part.state === 'output-available'
              ? 'output-available'
              : part.state,
          count: (last.count ?? 1) + 1,
        };
        return rows;
      }
      return [...rows, part];
    },
    [],
  );
  const run = parts.find((p) => p.type === 'data-run') as
    (AnyPart & { data: RunSummary }) | undefined;
  if (steps.length < 2) return null;
  const finished = steps.filter((s) => s.state === 'output-available').length;
  const title = run
    ? `${run.data.model} ran ${steps.length} steps in ${formatDuration(run.data.durationMs)}`
    : isStreaming
      ? `Working · ${finished}/${steps.length} steps done`
      : `${steps.length} steps`;
  return (
    <Task className="w-full" defaultOpen>
      <TaskTrigger title={title} />
      <TaskContent>
        {steps.map((step, i) => {
          const runner = runnerOf(step);
          return (
            <TaskItem
              key={`${step.type}-${i}`}
              className="flex items-start gap-2"
            >
              <span className="mt-0.5">
                <StepIcon state={step.state} />
              </span>
              <span className="min-w-0 flex-1">{describeStep(step)}</span>
              <span
                className={cn(
                  'shrink-0 rounded-full border px-1.5 py-px text-[10px] font-medium',
                  runner.muse
                    ? 'border-primary/30 bg-primary/10 text-primary-ink'
                    : 'text-muted-foreground',
                )}
              >
                {runner.label}
              </span>
            </TaskItem>
          );
        })}
      </TaskContent>
    </Task>
  );
}

/**
 * A failed step, kept quiet: the agent sees the same error and usually retries
 * with corrected input, so the run is not over when a step fails.
 */
export function StepError({
  label,
  errorText,
}: {
  label: string;
  errorText?: string;
}) {
  return (
    <div className="flex w-full items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
      <CircleAlertIcon className="mt-px size-3.5 shrink-0 text-amber-500" />
      <span className="min-w-0">
        <span className="font-medium text-foreground/80">{label} failed</span>
        {errorText ? `: ${errorText.slice(0, 240)}` : ''}
      </span>
    </div>
  );
}

/** Any tool without a dedicated card: its input and output, collapsed. */
export function GenericToolPart({ part }: { part: AnyPart }) {
  if (part.state === 'output-error') {
    return (
      <StepError
        label={describeStep({ ...part, state: 'input-available' })}
        errorText={part.errorText}
      />
    );
  }
  const toolPart = part as unknown as ToolPart;
  return (
    <Tool className="w-full">
      <ToolHeader
        type={toolPart.type as `tool-${string}`}
        state={toolPart.state}
      />
      <ToolContent>
        <ToolInput input={toolPart.input} />
        <ToolOutput
          output={
            part.output ? (
              <pre className="max-h-64 overflow-auto p-3 text-xs">
                {JSON.stringify(part.output, null, 2)}
              </pre>
            ) : undefined
          }
          errorText={part.errorText}
        />
      </ToolContent>
    </Tool>
  );
}

interface CitedArticle {
  pmid: string;
  title: string;
  url: string;
  supports: string;
}

/** Papers the literature sub-agent judged, listed as sources. */
export function LiteratureSources({ parts }: { parts: AnyPart[] }) {
  const articles = parts
    .filter(
      (p) =>
        p.type === 'tool-reviewLiterature' && p.state === 'output-available',
    )
    .flatMap((p) => (p.output?.articles as CitedArticle[] | undefined) ?? []);
  const unique = [...new Map(articles.map((a) => [a.pmid, a])).values()];
  if (unique.length === 0) return null;
  return (
    <Sources>
      <SourcesTrigger count={unique.length} />
      <SourcesContent>
        {unique.map((a) => (
          <Source
            key={a.pmid}
            href={a.url}
            title={`PMID ${a.pmid} · ${a.title}`}
          />
        ))}
      </SourcesContent>
    </Sources>
  );
}
