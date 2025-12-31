import type {
    AssistantModelMessage as CoreAssistantMessage,
    ToolModelMessage as CoreToolMessage,
    UIMessage,
} from 'ai';
import { clsx, type ClassValue } from 'clsx';
import { getCookie, setCookie } from 'cookies-next';
import { twMerge } from 'tailwind-merge';

import type { Message as DBMessage, Document } from '@/lib/db/schema';
import type { ChatMessage } from '@/lib/types';

// Combine class names with tailwind-merge
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// Get user's preferred color scheme
export function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark'; // Default to dark on server
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

// Save user theme preference
export function saveThemePreference(theme: string): void {
  setCookie('theme', theme, { maxAge: 60 * 60 * 24 * 365 }); // 1 year expiry
}

// Get user theme preference
export function getThemePreference(): string | null {
  return getCookie('theme') as string | null;
}

// Validate email format
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Validate password strength
export function getPasswordStrength(password: string): number {
  let strength = 0;

  // Length check
  if (password.length >= 8) strength += 20;

  // Character variety checks
  if (/[A-Z]/.test(password)) strength += 20; // Uppercase
  if (/[a-z]/.test(password)) strength += 20; // Lowercase
  if (/\d/.test(password)) strength += 20; // Numbers
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength += 20; // Special chars

  return strength;
}

// Get color based on password strength
export function getPasswordStrengthColor(strength: number): string {
  if (strength < 40) return 'bg-red-500';
  if (strength < 80) return 'bg-yellow-500';
  return 'bg-green-500';
}

interface ApplicationError extends Error {
  info: string;
  status: number;
}

export const fetcher = async (url: string) => {
  const res = await fetch(url);

  if (!res.ok) {
    const error = new Error(
      'An error occurred while fetching the data.',
    ) as ApplicationError;

    error.info = await res.json();
    error.status = res.status;

    throw error;
  }

  return res.json();
};

export const fetchWithErrorHandlers = async (input: string | URL | Request, init?: RequestInit) => {
  const res = await fetch(input, init);

  if (!res.ok) {
    const errorText = await res.text();
    let errorData;
    
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }

    // Import ChatSDKError dynamically to avoid circular imports
    const { ChatSDKError } = await import('@/lib/errors');
    
    // If it's a known SDK error format, throw ChatSDKError
    if (errorData.code && errorData.message) {
      throw new ChatSDKError(errorData.code, errorData.message);
    }
    
    // Otherwise throw a generic error
    const error = new Error(errorData.message || 'An error occurred') as ApplicationError;
    error.info = errorData;
    error.status = res.status;
    throw error;
  }

  return res;
};

export function getTextFromMessage(message: any): string {
  if (typeof message.content === 'string') {
    return message.content;
  }
  
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join(' ');
  }
  
  if (Array.isArray(message.content)) {
    return message.content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join(' ');
  }
  
  return '';
}

export function getLocalStorage(key: string) {
  if (typeof window !== 'undefined') {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  return [];
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function addToolMessageToChat({
  toolMessage,
  messages,
}: {
  toolMessage: CoreToolMessage;
  messages: Array<UIMessage>;
}): Array<UIMessage> {
  return messages.map((message) => {
    if ((message as any).toolInvocations) {
      return {
        ...message,
        toolInvocations: (message as any).toolInvocations.map((toolInvocation: any) => {
          const toolResult = toolMessage.content.find(
            (tool) => tool.type === 'tool-result' && tool.toolCallId === toolInvocation.toolCallId,
          );

          if (toolResult) {
            return {
              ...toolInvocation,
              state: 'result',
              result: (toolResult as any).result,
            };
          }

          return toolInvocation;
        }),
      };
    }

    return message;
  });
}

export function convertToUIMessages(
  messages: Array<DBMessage>,
): Array<ChatMessage> {
  return messages.reduce((chatMessages: Array<ChatMessage>, message) => {
    if (message.role === 'tool') {
      return addToolMessageToChat({
        toolMessage: message as CoreToolMessage,
        messages: chatMessages,
      });
    }

    let textContent = '';
    let reasoning: string | undefined = undefined;
    const toolInvocations: Array<any> = [];

    if (typeof (message as any).content === 'string') {
      textContent = (message as any).content;
    } else if (Array.isArray((message as any).content)) {
      for (const content of (message as any).content) {
        if (content.type === 'text') {
          textContent += content.text;
        } else if (content.type === 'tool-call') {
          toolInvocations.push({
            state: 'call',
            toolCallId: content.toolCallId,
            toolName: content.toolName,
            args: content.args,
          });
        } else if (content.type === 'reasoning') {
          reasoning = content.reasoningText;
        }
      }
    }

    chatMessages.push({
      id: message.id,
      role: message.role as ChatMessage['role'],
      content: textContent || '', // Ensure content is never empty/undefined
      parts: [{ type: 'text', text: textContent || '' }], // Always provide parts array
      reasoning,
      toolInvocations,
    } as ChatMessage);

    return chatMessages;
  }, []);
}

type ResponseMessageWithoutId = CoreToolMessage | CoreAssistantMessage;
type ResponseMessage = ResponseMessageWithoutId & { id: string };

export function sanitizeResponseMessages({
  messages,
  reasoningText,
}: {
  messages: Array<ResponseMessage>;
  reasoningText: string | undefined;
}) {
  const toolResultIds: Array<string> = [];

  for (const message of messages) {
    if (message.role === 'tool') {
      for (const content of (message as any).content) {
        if (content.type === 'tool-result') {
          toolResultIds.push(content.toolCallId);
        }
      }
    }
  }

  const messagesBySanitizedContent = messages.map((message) => {
    if (message.role !== 'assistant') return message;

    if (typeof (message as any).content === 'string') return message;

    const sanitizedContent = (message as any).content.filter((content: any) =>
      content.type === 'tool-call'
        ? toolResultIds.includes(content.toolCallId)
        : content.type === 'text'
          ? content.text.length > 0
          : true,
    );

    if (reasoningText) {
      sanitizedContent.push({ type: 'reasoning', reasoningText });
    }

    return {
      ...message,
      content: sanitizedContent,
    };
  });

  return messagesBySanitizedContent.filter(
    (message) => (message as any).content.length > 0,
  );
}

export function sanitizeUIMessages(messages: Array<UIMessage>): Array<UIMessage> {
  const messagesBySanitizedToolInvocations = messages.map((message) => {
    if (message.role !== 'assistant') return message;

    if (!(message as any).toolInvocations) return message;

    const toolResultIds: Array<string> = [];

    for (const toolInvocation of (message as any).toolInvocations) {
      if (toolInvocation.state === 'result') {
        toolResultIds.push(toolInvocation.toolCallId);
      }
    }

    const sanitizedToolInvocations = (message as any).toolInvocations.filter(
      (toolInvocation: any) =>
        toolInvocation.state === 'result' ||
        toolResultIds.includes(toolInvocation.toolCallId),
    );

    return {
      ...message,
      toolInvocations: sanitizedToolInvocations,
    };
  });

  return messagesBySanitizedToolInvocations.filter(
    (message) =>
      (message as any).content.length > 0 ||
      ((message as any).toolInvocations && (message as any).toolInvocations.length > 0),
  );
}

export function getMostRecentUserMessage(messages: Array<UIMessage>) {
  const userMessages = messages.filter((message) => message.role === 'user');
  return userMessages.at(-1);
}

export function getDocumentTimestampByIndex(
  documents: Array<Document>,
  index: number,
) {
  if (!documents) return new Date();
  if (index > documents.length) return new Date();

  return documents[index].createdAt;
}
