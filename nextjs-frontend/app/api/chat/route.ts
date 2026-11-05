/**
 * Chat endpoint. Every message goes to the Attma agent, which runs a workflow
 * with the tools of the sources the user enabled and streams each step to the
 * client as UI message parts. The finished assistant message is saved with all
 * its parts (tool inputs and outputs, sources, reasoning), so a reloaded chat
 * shows the same workflow and the agent can build on earlier results.
 */

import { auth } from '@/app/(auth)/auth';
import type { VisibilityType } from '@/components/chat/visibility-selector';
import { AnalysisSession } from '@/lib/analysis/session';
import { findLatestAnalysisSnapshot } from '@/lib/analysis/history';
import { buildTrace } from '@/lib/analysis/trace';
import { ensureAnalysisPart } from './ensure-analysis-part';
import { BIOSECURITY_CATEGORY_LABELS } from '@/lib/biosecurity/policy';
import { screenBiosecurity } from '@/lib/biosecurity/screen';
import { PrivacyLeakError, runWithPrivacy } from '@/lib/privacy/guard';
import { PrivacyVault } from '@/lib/privacy/vault';
import { agentPromptHash, createAttmaAgent } from '@/lib/ai/agents/attma-agent';
import {
  DEFAULT_CONNECTORS,
  type ConnectorId,
} from '@/lib/ai/connectors/catalog';
import { estimateCostUsd, SPARK_PRICES, WONDER_PRICES } from '@/lib/ai/pricing';
import { createDocument } from '@/lib/ai/tools/create-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { isWithinLimit } from '@/lib/ai/entitlements';
import { chatRunLock } from '@/lib/ai/run-lock';
import {
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import { convertToUIMessages } from '@/lib/utils';
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type ModelMessage,
  type ToolSet,
} from 'ai';
import { generateTitleFromUserMessage } from '../../(chat)/actions';
import { postRequestBodySchema, type PostRequestBody } from './schema';

// Python steps and literature sub-agents make a full workflow run for minutes.
export const maxDuration = 300;

// The model picker's choices; each is a Muse alias in lib/ai/providers.ts.
const MODEL_LABELS: Record<string, string> = {
  'chat-model': 'Muse Spark',
  'chat-model-standard': 'Muse Wonder',
  'chat-model-reasoning': 'Muse Wonder · high effort',
  'agent-model': 'Muse Wonder',
};
const AGENT_MODELS = new Set(Object.keys(MODEL_LABELS));

// One run per chat at a time: two concurrent runs would rebuild two trust sessions from the same history and race on save.

// Earlier steps go back to the model as a text log of each tool call and its
// result, trimmed so one large table does not crowd out the conversation.
// Muse's Responses API rejects replayed function_call items from an earlier
// request (store: false), so the log is plain text, which works with any model.
const MAX_STEP_INPUT_CHARS = 1_500;
const MAX_STEP_OUTPUT_CHARS = 3_000;

type UIPart = ChatMessage['parts'][number] & {
  type: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  text?: string;
};

const clip = (value: unknown, max: number) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text && text.length > max
    ? `${text.slice(0, max)}… (truncated)`
    : text;
};

function partAsText(part: UIPart): string | null {
  if (part.type === 'text') return part.text ?? null;
  if (part.type === 'file') {
    const file = part as UIPart & {
      url: string;
      mediaType: string;
      filename?: string;
    };
    return `Attached file: ${file.filename ?? 'file'} (${file.mediaType}): ${file.url}`;
  }
  if (part.type.startsWith('tool-') && part.state === 'output-available') {
    return `[Earlier step: ${part.type.slice(5)}]\nInput: ${clip(part.input, MAX_STEP_INPUT_CHARS)}\nResult: ${clip(part.output, MAX_STEP_OUTPUT_CHARS)}`;
  }
  return null;
}

/**
 * Saved messages as model input. Attachments become a line with their URL, as
 * in the current message, since the agent opens files with its tools.
 */
function historyFrom(saved: ChatMessage[]): ModelMessage[] {
  return saved.flatMap((m): ModelMessage[] => {
    if (m.role !== 'user' && m.role !== 'assistant') return [];
    const text = (m.parts as UIPart[])
      .map(partAsText)
      .filter(Boolean)
      .join('\n\n');
    return text ? [{ role: m.role, content: text }] : [];
  });
}

/** The user's text, with attached files listed by URL so tools can open them. */
function describeMessage(message: PostRequestBody['message']) {
  const parts = message.parts ?? [];
  const text = parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
  const files = parts.filter((p) => p.type === 'file');
  if (files.length === 0) return text || message.content || '';
  return `${text}\n\nAttached files:\n${files
    .map(
      (f) => `- ${f.filename ?? f.name ?? 'file'} (${f.mediaType}): ${f.url}`,
    )
    .join('\n')}`;
}

/**
 * One privacy vault per request: every model call in this run (the
 * biosecurity screen, the title, the agent and its sub-agents) masks patient
 * identifiers with the same tokens, and the reply carries the tokens so the
 * researcher's browser can show the real values again.
 */
export async function POST(request: Request) {
  const vault = new PrivacyVault();
  return runWithPrivacy(vault, () => handleChat(request, vault));
}

/** What the researcher sees when a model call is stopped or fails. */
function runErrorMessage(error: unknown): string {
  console.error('Agent run failed', error);
  if (error instanceof PrivacyLeakError) return error.message;
  return 'The agent hit an error. Try again, or rephrase the request.';
}

async function handleChat(request: Request, vault: PrivacyVault) {
  let body: PostRequestBody;
  try {
    body = postRequestBodySchema.parse(await request.json());
  } catch {
    return new ChatSDKError('bad_request:api').toResponse();
  }
  const {
    id,
    message,
    selectedChatModel,
    selectedVisibilityType,
    projectId,
    connectors,
    review,
  } = body;

  const session = await auth();
  if (!session?.user?.id) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }
  const userId = session.user.id;

  const chatId = id === 'new' ? crypto.randomUUID() : id;
  const existing = await getChatById({ id: chatId });
  if (existing && existing.userId !== userId) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  // A per-user daily cap keeps one account from burning the model budget; the count comes from saved messages, so it survives across instances.
  try {
    const messagesToday = await getMessageCountByUserId({ id: userId });
    if (!isWithinLimit('free', 'messages', messagesToday)) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }
  } catch (error) {
    // Failing open keeps chat available if the count query hiccups; the cap is abuse protection, not a correctness gate.
    console.error('Message count check failed', error);
  }

  // Create the chat while the agent starts, so the title is not on the critical path.
  const chatReady = existing
    ? Promise.resolve()
    : generateTitleFromUserMessage({ message }).then((title) =>
        saveChat({
          id: chatId,
          title,
          userId,
          visibility: selectedVisibilityType as VisibilityType,
          projectId: projectId || null,
        }),
      );

  const savedMessages = existing
    ? convertToUIMessages(await getMessagesByChatId({ id: chatId }))
    : [];
  const history = historyFrom(savedMessages);
  const messages: ModelMessage[] = [
    ...history,
    { role: 'user', content: describeMessage(message) },
  ];

  // The trust state rides in the saved messages, so a follow-up reply resumes the same analysis.
  let analysisSession = AnalysisSession.fromHistory(
    findLatestAnalysisSnapshot(savedMessages),
  );
  // Approving a report waiting for review needs no model call; the saved
  // status becomes approved and the next turn starts from it.
  const approved =
    review?.decision === 'approve' &&
    analysisSession.status === 'awaiting_review' &&
    analysisSession.approve().ok;
  if (analysisSession.status === 'approved' && !approved) {
    // An approved report is frozen, so a later message starts a fresh analysis instead of silently reopening signed-off work.
    analysisSession = new AnalysisSession();
  } else if (!approved && analysisSession.status !== 'collecting') {
    analysisSession.reopen();
  }

  const analysisData = () => ({
    status: analysisSession.status,
    checklist: analysisSession.checklist,
    facts: analysisSession.facts,
    report: analysisSession.report,
    openInputRequest: analysisSession.openInputRequest,
    refusals: analysisSession.refusals,
    snapshot: analysisSession.toSnapshot(),
  });

  if (!chatRunLock.acquire(chatId, Date.now())) {
    return new ChatSDKError('busy:chat').toResponse();
  }
  // Release on abort too, because a stopped or closed run may never reach the stream's end handler.
  request.signal.addEventListener('abort', () => chatRunLock.release(chatId), {
    once: true,
  });

  // One save path for the agent run and the approval shortcut, so both land in the chat the same way.
  const handleEnd = async ({
    responseMessage,
  }: {
    responseMessage: ChatMessage;
  }) => {
    chatRunLock.release(chatId);
    // A failed run streams no text or steps; saving it would leave an empty
    // reply in the chat, so only the question is kept.
    const answered = (responseMessage.parts as UIPart[]).some(
      (p) => p.type === 'text' || p.type.startsWith('tool-'),
    );
    try {
      await chatReady;
      await saveMessages({
        messages: [
          {
            id: message.id,
            chatId,
            role: 'user',
            content: message.parts ?? [
              { type: 'text', text: message.content ?? '' },
            ],
            createdAt: new Date(),
          },
          ...(answered
            ? [
                {
                  id: crypto.randomUUID(),
                  chatId,
                  role: 'assistant' as const,
                  content: ensureAnalysisPart(
                    responseMessage.parts,
                    Boolean(analysisSession.checklist),
                    analysisData(),
                  ),
                  createdAt: new Date(),
                },
              ]
            : []),
        ],
      });
    } catch (error) {
      console.error('Failed to save the chat', error);
    }
  };

  // Every new request is screened before any tool runs; an approval carries no new request, so it skips the screen.
  const userText = [
    message.content ?? '',
    ...(message.parts ?? [])
      .filter((part) => part.type === 'text')
      .map((part) => (part as { text: string }).text),
    ...(message.parts ?? [])
      .filter((part) => part.type === 'file')
      .map(
        (part) =>
          `Attachment: ${(part as { filename?: string }).filename ?? 'file'}`,
      ),
  ]
    .join('\n')
    .trim();
  const lastAssistantText = [...savedMessages]
    .reverse()
    .find((entry) => entry.role === 'assistant');
  const biosecurity =
    approved || !userText
      ? null
      : await screenBiosecurity({
          checkpoint: 'intake',
          text: userText,
          context: lastAssistantText
            ? String(historyFrom([lastAssistantText])[0]?.content ?? '').slice(
                0,
                2000,
              )
            : undefined,
        });

  if (biosecurity && biosecurity.decision !== 'accept') {
    const reply =
      biosecurity.decision === 'refuse'
        ? `This request is outside what Attma supports: ${BIOSECURITY_CATEGORY_LABELS[biosecurity.category]}. Attma is for human genetics and biomedical research workflows.`
        : biosecurity.rationale;
    const stream = createUIMessageStream<ChatMessage>({
      execute: async ({ writer }) => {
        writer.write({ type: 'data-biosecurity', data: biosecurity });
        if (vault.size > 0) {
          writer.write({ type: 'data-privacy', data: vault.summary() });
        }
        writer.write({ type: 'text-start', id: 'biosecurity' });
        writer.write({
          type: 'text-delta',
          id: 'biosecurity',
          delta: reply,
        });
        writer.write({ type: 'text-end', id: 'biosecurity' });
      },
      onError: runErrorMessage,
      onEnd: handleEnd,
    });
    return createUIMessageStreamResponse({ stream });
  }

  if (approved) {
    const stream = createUIMessageStream<ChatMessage>({
      execute: async ({ writer }) => {
        writer.write({ type: 'text-start', id: 'approved' });
        writer.write({
          type: 'text-delta',
          id: 'approved',
          delta: 'Approved.',
        });
        writer.write({ type: 'text-end', id: 'approved' });
        writer.write({ type: 'data-analysis', data: analysisData() });
      },
      onError: runErrorMessage,
      onEnd: handleEnd,
    });
    return createUIMessageStreamResponse({ stream });
  }

  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer }) => {
      const documentTools = {
        createDocument: createDocument({ session, dataStream: writer }),
        updateDocument: updateDocument({ session, dataStream: writer }),
        requestSuggestions: requestSuggestions({ session, dataStream: writer }),
      } as ToolSet;

      const model = AGENT_MODELS.has(selectedChatModel)
        ? selectedChatModel
        : 'agent-model';
      const agent = createAttmaAgent({
        userId,
        chatId,
        connectors: (connectors ?? DEFAULT_CONNECTORS) as ConnectorId[],
        model,
        extraTools: documentTools,
        analysis: analysisSession,
      });
      const startedAt = Date.now();
      // The screen ran before the agent, so its verdict is the first part of this message.
      if (biosecurity) {
        writer.write({ type: 'data-biosecurity', data: biosecurity });
      }
      const result = await agent.stream({
        messages,
        abortSignal: request.signal,
      });
      // Forwarded chunk by chunk so the run summary below lands after the
      // agent's last part, inside the same assistant message.
      for await (const chunk of toUIMessageStream<ToolSet, ChatMessage>({
        stream: result.stream,
        sendReasoning: true,
        sendSources: true,
        sendFinish: false,
        // Tool errors reach the card and the log with their real message, so
        // a failed step says why (the agent sees the same text and retries).
        onError: (error) => {
          const text = error instanceof Error ? error.message : String(error);
          console.error('Agent step failed:', text);
          return text;
        },
        // The gate state is written on every step, so a stopped run still saves its checklist and verified facts.
        onStepEnd: () => {
          if (analysisSession.checklist) {
            writer.write({ type: 'data-analysis', data: analysisData() });
          }
        },
      })) {
        writer.write(chunk);
      }
      const [steps, usage] = await Promise.all([
        result.steps,
        result.totalUsage,
      ]);
      // Saved with the assistant message so the next turn rebuilds the session and the UI can render the gate.
      if (analysisSession.checklist) {
        writer.write({ type: 'data-analysis', data: analysisData() });
      }
      const costUsd = estimateCostUsd(
        {
          inputTokens: usage.inputTokens ?? 0,
          cachedTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
        },
        model === 'chat-model' ? SPARK_PRICES : WONDER_PRICES,
      );
      // The trace names the model, prompt version and tokens of every step, so a reviewed report can be audited afterwards.
      const trace = buildTrace(steps, {
        model: MODEL_LABELS[model] ?? 'Muse Wonder',
        promptHash: agentPromptHash(
          (connectors ?? DEFAULT_CONNECTORS) as ConnectorId[],
          true,
          true,
        ),
        durationMs: Date.now() - startedAt,
      });
      writer.write({ type: 'data-trace', data: trace });
      writer.write({
        type: 'data-run',
        data: {
          model: MODEL_LABELS[model] ?? 'Muse Wonder',
          durationMs: Date.now() - startedAt,
          toolCalls: steps.reduce((n, step) => n + step.toolCalls.length, 0),
          totalTokens: usage.totalTokens,
          cachedTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
          costUsd,
        },
      });
      // Saved with the message, so a reloaded chat still shows the real values.
      if (vault.size > 0 || vault.unscannedFiles > 0) {
        writer.write({ type: 'data-privacy', data: vault.summary() });
      }
    },
    onError: runErrorMessage,
    onEnd: handleEnd,
  });

  return createUIMessageStreamResponse({ stream });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });
  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });
  return Response.json(deletedChat, { status: 200 });
}
