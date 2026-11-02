import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/app/(auth)/auth';
import { getChatsByUserId, getMessagesByChatId } from '@/lib/db/queries';

// The console reads the saved analysis and trace parts, so a reviewer can audit a run without reopening the chat.
interface AnalysisPart {
  status?: string;
  checklist?: Array<{ id: string; kind: string }> | null;
  facts?: Array<{ id: string }> | null;
  refusals?: number;
}

interface TracePart {
  model?: string;
  promptHash?: string;
  durationMs?: number;
  steps?: Array<{
    step: number;
    tools: string[];
    inputTokens: number;
    outputTokens: number;
  }>;
}

function partsOf(content: unknown): Array<Record<string, unknown>> {
  return Array.isArray(content)
    ? content.filter(
        (part): part is Record<string, unknown> =>
          part !== null && typeof part === 'object',
      )
    : [];
}

function lastPart<T>(
  messages: Array<{ content: unknown }>,
  type: string,
): T | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    for (const part of partsOf(messages[i].content)) {
      if (part.type === type) return (part.data ?? null) as T | null;
    }
  }
  return null;
}

export default async function ConsolePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const chats = (await getChatsByUserId({ id: session.user.id })).slice(0, 20);
  const rows = await Promise.all(
    chats.map(async (chat) => {
      const messages = await getMessagesByChatId({ id: chat.id });
      return {
        chat,
        analysis: lastPart<AnalysisPart>(messages, 'data-analysis'),
        trace: lastPart<TracePart>(messages, 'data-trace'),
      };
    }),
  );
  const audited = rows.filter((row) => row.analysis !== null);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-light tracking-tight">Review console</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Read-only audit of your analysed chats: gate status, cited facts, and
        the per-step trace. Research use only, not a diagnosis.
      </p>
      {audited.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          No analysed chats yet. Run a variant or rare-disease case in chat
          first.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {audited.map(({ chat, analysis, trace }) => (
            <li
              key={chat.id}
              className="rounded-2xl border border-border/60 bg-card/40 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/chat/${chat.id}`}
                  className="text-sm font-medium underline-offset-4 hover:underline"
                >
                  {chat.title}
                </Link>
                <span className="rounded-full border px-2 py-0.5 text-xs">
                  {analysis?.status ?? 'unknown'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {analysis?.checklist?.length ?? 0} checklist items,{' '}
                  {analysis?.facts?.length ?? 0} facts,{' '}
                  {analysis?.refusals ?? 0} refusals
                </span>
              </div>
              {trace ? (
                <div className="mt-3 text-xs text-muted-foreground">
                  <p>
                    {trace.model} · prompt {trace.promptHash} ·{' '}
                    {Math.round((trace.durationMs ?? 0) / 1000)}s ·{' '}
                    {trace.steps?.length ?? 0} steps
                  </p>
                  <ul className="mt-2 space-y-1">
                    {(trace.steps ?? []).map((step) => (
                      <li key={step.step}>
                        Step {step.step}: {step.tools.join(', ') || 'text'} (
                        {step.inputTokens} in, {step.outputTokens} out)
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
