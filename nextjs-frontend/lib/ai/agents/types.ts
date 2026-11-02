/** Shared result types for agent tools. */

/** Tool execution result with metadata */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  source?: string;
  citations?: Citation[];
  executionTime?: number;
}

/**
 * Citation for source tracking
 */
export interface Citation {
  type: 'paper' | 'database' | 'web' | 'api';
  title: string;
  url?: string;
  pmid?: string;
  doi?: string;
  authors?: string[];
  year?: number;
}
