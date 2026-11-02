/**
 * Chat SDK Error handling for the application
 */

export type ChatSDKErrorCode =
  | 'bad_request:api'
  | 'busy:chat'
  | 'unauthorized:chat'
  | 'forbidden:chat'
  | 'rate_limit:chat'
  | 'unauthorized:document'
  | 'forbidden:document'
  | 'not_found:document';

export class ChatSDKError extends Error {
  public readonly code: ChatSDKErrorCode;
  public readonly details?: string;

  constructor(code: ChatSDKErrorCode, details?: string) {
    const message = ChatSDKError.getErrorMessage(code, details);
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'ChatSDKError';
  }

  private static getErrorMessage(
    code: ChatSDKErrorCode,
    details?: string,
  ): string {
    const baseMessages: Record<ChatSDKErrorCode, string> = {
      'bad_request:api': 'Invalid request',
      'busy:chat': 'This chat is still running. Wait for it to finish.',
      'unauthorized:chat': 'You must be logged in to access this chat',
      'forbidden:chat': 'You do not have permission to access this chat',
      'rate_limit:chat': 'You have exceeded the message limit for today',
      'unauthorized:document': 'You must be logged in to access this document',
      'forbidden:document':
        'You do not have permission to access this document',
      'not_found:document': 'Document not found',
    };

    const baseMessage = baseMessages[code] || 'An error occurred';
    return details ? `${baseMessage}: ${details}` : baseMessage;
  }

  public toResponse(): Response {
    const statusCodes: Record<string, number> = {
      bad_request: 400,
      busy: 409,
      unauthorized: 401,
      forbidden: 403,
      not_found: 404,
      rate_limit: 429,
    };

    const errorType = this.code.split(':')[0];
    const statusCode = statusCodes[errorType] || 500;

    return new Response(
      JSON.stringify({
        error: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      }),
      {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }
}
