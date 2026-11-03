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
import {
  CheckIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  LoaderIcon,
  SearchIcon,
} from 'lucide-react';
import { describeStep, refusalProblemsOf, runnerOf } from './step-labels';

export { describeStep, refusalProblemsOf, runnerOf } from './step-labels';

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

interface RunSummary {
  model: string;
  durationMs: number;
  toolCalls: number;
  totalTokens?: number;
  cachedTokens?: number;
  costUsd?: number;
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
      const groupable =
        (part.type === 'tool-web_search' && last?.type === 'tool-web_search') ||
        (part.type === 'tool-recordFact' && last?.type === 'tool-recordFact');
      if (groupable && last) {
        rows[rows.length - 1] = {
          ...part,
          // Done once any step in the group returned; failures mid-run are
          // retried by the agent and do not fail the group.
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
  const costUsd = run?.data.costUsd;
  const title = run
    ? `${run.data.model} ran ${steps.length} steps in ${formatDuration(run.data.durationMs)}${run.data.totalTokens != null ? ` · ${run.data.totalTokens.toLocaleString()} tokens` : ''}${costUsd != null ? ` · ~$${costUsd.toFixed(2)}` : ''}`
    : isStreaming
      ? `Working · ${finished}/${steps.length} steps done`
      : `${steps.length} steps`;
  return (
    <Task className="w-full" defaultOpen>
      {run ? (
        <TaskTrigger title={title}>
          <div className="flex w-full cursor-pointer items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <SearchIcon className="size-4 shrink-0" />
            <p className="min-w-0 text-sm">
              {run.data.model} ran {steps.length} steps in{' '}
              {formatDuration(run.data.durationMs)}
              {run.data.totalTokens != null
                ? ` · ${run.data.totalTokens.toLocaleString()} tokens`
                : ''}
              {run.data.cachedTokens
                ? ` · ${run.data.cachedTokens.toLocaleString()} cached`
                : ''}
              {costUsd != null ? (
                <>
                  {' · '}
                  <span title="Estimate at Meta Model API Standard prices; excludes sub-agent calls">
                    ~${costUsd.toFixed(2)}
                  </span>
                </>
              ) : null}
            </p>
            <ChevronDownIcon className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
          </div>
        </TaskTrigger>
      ) : (
        <TaskTrigger title={title} />
      )}
      <TaskContent>
        {steps.map((step, i) => {
          const runner = runnerOf(step);
          const problems =
            step.type === 'tool-submitReport' ? refusalProblemsOf(step) : [];
          return (
            <div key={`${step.type}-${i}`} className="flex flex-col gap-1">
              <TaskItem className="flex items-start gap-2">
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
              {problems.length > 0 ? (
                <div className="ml-6 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-foreground">
                  <div className="flex items-start gap-2">
                    <CircleAlertIcon className="mt-px size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="min-w-0">
                      <p className="font-medium">Why the report was refused</p>
                      <ul className="mt-1 list-disc pl-4">
                        {problems.map((problem) => (
                          <li key={problem}>{problem}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
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
      {/* Error texts often carry URLs or ids with no spaces; letting them break anywhere keeps one failed step from widening the whole page on a phone. */}
      <span className="min-w-0 [overflow-wrap:anywhere]">
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
