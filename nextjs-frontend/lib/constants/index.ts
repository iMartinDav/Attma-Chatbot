/**
 * Application constants
 */

export const isProductionEnvironment = process.env.NODE_ENV === 'production';

export const DEFAULT_MESSAGE_LIMIT = 10;
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const SUPPORTED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'application/pdf',
  'text/csv',
  'application/json',
];

export const API_ENDPOINTS = {
  CHAT: '/api/chat',
  SEARCH: '/api/search',
  DOCUMENT: '/api/document',
  VOTE: '/api/vote',
} as const;

export const CHAT_MODELS = {
  GPT4: 'gpt-4',
  GPT35: 'gpt-3.5-turbo',
  CLAUDE: 'claude-3-sonnet',
} as const;

export const DATABASE_CONFIG = {
  MAX_CONNECTIONS: 10,
  CONNECTION_TIMEOUT: 5000,
} as const;

export const RATE_LIMITS = {
  MESSAGES_PER_DAY: 100,
  REQUESTS_PER_MINUTE: 10,
} as const;
