import 'server-only';

import { AsyncLocalStorage } from 'node:async_hooks';

import type {
  LanguageModelV4Message,
  LanguageModelV4Middleware,
  LanguageModelV4Prompt,
} from '@ai-sdk/provider';

import { PrivacyVault } from './vault';

/**
 * The privacy guard at the model boundary.
 *
 * Every model call in Attma (the agent, sub-agents, titles, tool-call repair
 * and the biosecurity reviewer) goes through `myProvider`, and this
 * middleware masks the prompt before it leaves: the researcher's messages,
 * earlier answers, tool arguments and tool results. A chat request opens one
 * vault (`runWithPrivacy`), so every call in it shares the same tokens.
 *
 * After masking, an outbound check searches the whole prompt for any value
 * the vault holds. If one survived, the call is refused (fail closed) and
 * nothing is sent.
 */

const storage = new AsyncLocalStorage<PrivacyVault>();

export function runWithPrivacy<T>(vault: PrivacyVault, fn: () => T): T {
  return storage.run(vault, fn);
}

export function currentVault(): PrivacyVault | undefined {
  return storage.getStore();
}

/**
 * Tools that query public research databases. Their results describe genes,
 * variants and papers, not patients, so they are not scanned for new
 * identifiers (that would mask every publication date); values already in
 * the vault are still masked if a tool echoes them.
 */
const PUBLIC_DATA_TOOLS = new Set([
  'rankDiagnoses',
  'prioritizeVariants',
  'proteinStructure',
  'reviewLiterature',
  'searchPubMed',
  'lookupGene',
  'enrichGenes',
  'searchReactome',
  'searchKEGG',
  'stringInteractions',
  'web_search',
  'predictVariantEffect',
]);

export class PrivacyLeakError extends Error {
  constructor(types: string[]) {
    super(
      `Privacy guard stopped a model call: protected values (${types.join(', ')}) were still present after masking.`,
    );
    this.name = 'PrivacyLeakError';
  }
}

function maskJson(
  value: unknown,
  vault: PrivacyVault,
  detect: boolean,
): unknown {
  if (typeof value === 'string') return vault.mask(value, { detect });
  if (Array.isArray(value))
    return value.map((item) => maskJson(item, vault, detect));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        maskJson(item, vault, detect),
      ]),
    );
  }
  return value;
}

function maskMessage(
  message: LanguageModelV4Message,
  vault: PrivacyVault,
): LanguageModelV4Message {
  // The system prompt is Attma's own instructions.
  if (message.role === 'system') return message;

  const content = (
    message.content as unknown as Array<Record<string, unknown>>
  ).map((part) => {
    switch (part.type) {
      case 'text':
        return { ...part, text: vault.mask(String(part.text ?? '')) };
      case 'reasoning':
        return {
          ...part,
          text: vault.mask(String(part.text ?? ''), { detect: false }),
        };
      case 'tool-call':
        return {
          ...part,
          input:
            typeof part.input === 'string'
              ? vault.mask(part.input)
              : maskJson(part.input, vault, true),
        };
      case 'tool-result': {
        const detect = !PUBLIC_DATA_TOOLS.has(String(part.toolName));
        return { ...part, output: maskJson(part.output, vault, detect) };
      }
      case 'file':
        // Images and PDFs reach the model as bytes; this rules tier cannot read them.
        vault.noteUnscannedFile(
          String(
            part.filename ??
              (typeof part.data === 'string'
                ? part.data.slice(0, 120)
                : `${part.mediaType}`),
          ),
        );
        return part;
      default:
        return part;
    }
  });
  return { ...message, content } as unknown as LanguageModelV4Message;
}

/** Everything sent to the model as text, for the outbound check. */
function outboundText(prompt: LanguageModelV4Prompt): string {
  return JSON.stringify(
    prompt
      .filter((message) => message.role !== 'system')
      .map((message) =>
        (message.content as unknown as Array<Record<string, unknown>>).map(
          (part) =>
            part.type === 'file'
              ? null
              : { ...part, providerOptions: undefined },
        ),
      ),
  );
}

export const privacyMiddleware: LanguageModelV4Middleware = {
  specificationVersion: 'v4',
  transformParams: async ({ params }) => {
    // Outside a chat request (scripts, evals) each call gets its own vault.
    const vault = currentVault() ?? new PrivacyVault();
    const prompt = params.prompt.map((message) => maskMessage(message, vault));
    const leaked = vault.leaks(outboundText(prompt));
    if (leaked.length > 0) {
      throw new PrivacyLeakError([
        ...new Set(leaked.map((entry) => entry.type)),
      ]);
    }
    return { ...params, prompt };
  },
};

/** Added to the agent's instructions so it treats tokens as names, not as gaps. */
export const PRIVACY_INSTRUCTIONS = `- Identifiers such as [[PERSON_1]], [[MRN_1]] or [[SAMPLE_ID_1]] are protected values: Attma's privacy guard replaced them before this conversation reached you, and the researcher sees the real values. Treat each token as the identifier it stands for, copy it exactly when you refer to it, and never guess, reconstruct or ask for the value behind it.`;
