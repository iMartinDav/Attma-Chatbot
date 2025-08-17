import type { SearchMessage } from '@/components/chat/message-search';
import { generateUUID } from '@/lib/utils';

/**
 * Options to customize the search behavior
 */
export interface SearchOptions {
  userLocation?: {
    country?: string; // Two-letter ISO country code
    city?: string; // Free text string
    region?: string; // Free text string
    timezone?: string; // IANA timezone
  };
  contextSize?: 'low' | 'medium' | 'high'; // Controls amount of search context
}

/**
 * Structure of search results from the API
 */
export interface SearchResult {
  content: string;
  annotations?: Array<{
    type: string;
    url_citation?: {
      start_index: number;
      end_index: number;
      url: string;
      title: string;
    };
  }>;
  success: boolean;
}

/**
 * Executes a web search query using the backend search API
 */
export async function executeWebSearch(
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult> {
  try {
    // Trim long queries in logs
    const logQuery = query.substring(0, 50) + (query.length > 50 ? '...' : '');
    console.log('Executing web search query:', logQuery);

    // Call the search API endpoint
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, options }),
    });

    if (!response.ok) {
      throw new Error(`Search failed with status: ${response.status}`);
    }

    // Parse the search results
    const data = await response.json();

    return {
      content: data.content || 'No results found',
      annotations: data.annotations || [],
      success: data.success ?? true,
    };
  } catch (error) {
    console.error('Web search execution error:', error);
    return {
      content: 'Error connecting to search service. Please try again later.',
      annotations: [],
      success: false,
    };
  }
}

/**
 * Creates user and pending messages for the search flow
 */
export function createSearchMessages(query: string): {
  userMessage: SearchMessage;
  pendingMessage: SearchMessage;
} {
  // Create user message with the search query
  const userMessage: SearchMessage = {
    id: generateUUID(),
    role: 'user',
    parts: [{ type: 'text', text: query }],
    createdAt: new Date(),
  };

  // Create pending message to show during search
  const pendingMessage: SearchMessage = {
    id: generateUUID(),
    role: 'assistant',
    parts: [{ type: 'text', text: 'Searching the web...' }],
    createdAt: new Date(),
    sourceType: 'searching',
  };

  return { userMessage, pendingMessage };
}

/**
 * Creates a formatted response message from search results with clean annotations
 */
export function createSearchResponseMessage(
  searchResult: SearchResult,
): SearchMessage {
  console.log(
    'Creating search response with annotations:',
    searchResult.annotations,
  );

  // Process annotations to ensure consistent format
  const cleanedAnnotations = searchResult.annotations
    ? searchResult.annotations
        .filter((a) => {
          const isValid =
            a &&
            typeof a === 'object' &&
            a.type === 'url_citation' &&
            a.url_citation?.url;

          // Log what's being filtered
          console.log(`Annotation valid? ${isValid}`, a);
          return isValid;
        })
        .map((a) => ({
          type: 'url_citation',
          url_citation: {
            url: a.url_citation?.url || '',
            title: a.url_citation?.title || '',
            ...(a.url_citation?.start_index !== undefined && {
              start_index: a.url_citation.start_index,
            }),
            ...(a.url_citation?.end_index !== undefined && {
              end_index: a.url_citation.end_index,
            }),
          },
        }))
    : [];

  console.log('Cleaned annotations:', cleanedAnnotations);

  return {
    id: generateUUID(),
    role: 'assistant',
    parts: [{ type: 'text', text: searchResult.content }],
    createdAt: new Date(),
    sourceType: 'web-search',
    reasoningText: 'Information retrieved from web search',
    annotations: cleanedAnnotations,
  };
}
