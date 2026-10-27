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
        ? `Reviewed PubMed for ${output.gene}: ${output.verdict} evidence`
        : `Reviewing PubMed for ${input.gene ?? 'the gene'}`;
    default:
      return name
        .replace(/([A-Z])/g, ' $1')
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

/** A timeline of the agent's tool steps, shown when it took more than one. */
export function AgentSteps({ parts }: { parts: AnyPart[] }) {
  const steps = toolParts(parts);
  if (steps.length < 2) return null;
  const finished = steps.filter((s) => s.state === 'output-available').length;
  return (
    <Task className="w-full" defaultOpen>
      <TaskTrigger title={`Agent steps · ${finished}/${steps.length} done`} />
      <TaskContent>
        {steps.map((step, i) => (
          <TaskItem
            key={`${step.type}-${i}`}
            className="flex items-center gap-2"
          >
            <StepIcon state={step.state} />
            {describeStep(step)}
          </TaskItem>
        ))}
      </TaskContent>
    </Task>
  );
}

/** Any tool without a dedicated card: its input and output, collapsed. */
export function GenericToolPart({ part }: { part: AnyPart }) {
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
