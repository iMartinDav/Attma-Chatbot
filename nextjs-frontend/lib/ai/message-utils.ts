/**
 * AI SDK v5 UIMessage utilities
 * Provides clean abstraction for handling v5 UIMessage structure
 */

import type { ChatMessage } from '@/lib/types';
import { generateUUID } from '@/lib/utils';
import type { UIMessage } from 'ai';

// Type-safe message interface that handles both v4 and v5 formats
export type SafeMessage = UIMessage | ChatMessage | any;

// Type guard to check if a message has v5 parts structure
export function hasPartsStructure(message: SafeMessage): boolean {
  return message && Array.isArray(message.parts);
}

// Extract text content from UIMessage following v5 patterns
export function getMessageText(message: SafeMessage): string {
  // v5 UIMessage structure with parts array
  if (hasPartsStructure(message)) {
    return message.parts
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join('');
  }

  // v4 fallback for legacy messages
  if (message.content && typeof message.content === 'string') {
    return message.content;
  }

  return '';
}

// Extract file parts from UIMessage following v5 patterns
export function getMessageFiles(message: SafeMessage): any[] {
  // v5 UIMessage structure with parts array
  if (hasPartsStructure(message)) {
    return message.parts.filter((part: any) => part.type === 'file');
  }

  // v4 fallback for legacy messages
  return message.experimental_attachments || [];
}

// Extract reasoning parts from UIMessage following v5 patterns
export function getMessageReasoning(message: SafeMessage): string {
  // v5 UIMessage structure with parts array
  if (hasPartsStructure(message)) {
    const reasoningParts = message.parts
      .filter((part: any) => part.type === 'reasoning')
      .map((part: any) => part.text);
    return reasoningParts.join('');
  }

  // v4 fallback for legacy messages
  return message.reasoningText || '';
}

// Create a text message in v5 format
export function createTextMessage(
  role: 'user' | 'assistant',
  text: string,
  id?: string,
): ChatMessage {
  return {
    id: id || generateUUID(),
    role,
    parts: [{ type: 'text', text }],
  };
}

// Update message text content while preserving v5 structure
export function updateMessageText(
  message: SafeMessage,
  newText: string,
): SafeMessage {
  // v5 UIMessage structure
  if (hasPartsStructure(message)) {
    return {
      ...message,
      parts: [
        // Keep non-text parts
        ...message.parts.filter((part: any) => part.type !== 'text'),
        // Add new text part
        { type: 'text', text: newText },
      ],
    };
  }

  // v4 fallback - convert to v5 structure
  return {
    ...message,
    parts: [{ type: 'text', text: newText }],
  };
}

// Check if message is empty (no meaningful content)
export function isMessageEmpty(message: SafeMessage): boolean {
  const text = getMessageText(message);
  const files = getMessageFiles(message);
  const reasoning = getMessageReasoning(message);

  return !text.trim() && files.length === 0 && !reasoning.trim();
}

// Extract source parts/annotations
export function getMessageSources(
  message: SafeMessage,
): Array<{ url: string; title?: string }> {
  if (hasPartsStructure(message)) {
    // Check for source parts (AI SDK v6 standard)
    const sourceParts = message.parts
      .filter((part: any) => part.type === 'source')
      .map((part: any) => ({
        url: part.source.url,
        title: part.source.title,
      }));

    if (sourceParts.length > 0) return sourceParts;

    // Check for tool results that contain sources (legacy/custom implementation)
    // specific to our web_search tool output format
    const toolResults = message.parts
      .filter(
        (part: any) =>
          part.type === 'tool-result' && part.toolName === 'web_search',
      )
      .flatMap((part: any) => part.result?.results || [])
      .map((res: any) => ({
        url: res.url,
        title: res.title,
      }));

    if (toolResults.length > 0) return toolResults;
  }

  return [];
}
