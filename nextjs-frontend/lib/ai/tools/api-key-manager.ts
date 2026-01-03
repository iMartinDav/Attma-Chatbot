/**
 * @fileoverview API Key Manager with Rotation
 * 
 * Manages multiple API keys for rate-limited services,
 * implementing automatic rotation and health tracking.
 */

// ============================================================================
// Types
// ============================================================================

interface ApiKeyConfig {
  key: string;
  name: string;
  requestsPerSecond?: number;
  requestsPerDay?: number;
}

interface KeyState {
  config: ApiKeyConfig;
  requestCount: number;
  lastReset: number;
  isHealthy: boolean;
  lastError?: string;
}

// ============================================================================
// API Key Manager Class
// ============================================================================

/**
 * Manages API key rotation for rate-limited services
 * 
 * @example
 * ```typescript
 * const pubmedKeys = new ApiKeyManager('pubmed', [
 *   { key: 'key1', name: 'Primary' },
 *   { key: 'key2', name: 'Secondary' },
 * ]);
 * 
 * const key = pubmedKeys.getKey();
 * await pubmedKeys.recordUsage(key);
 * ```
 */
export class ApiKeyManager {
  private serviceName: string;
  private keys: Map<string, KeyState> = new Map();
  private currentIndex: number = 0;
  private keyOrder: string[] = [];

  constructor(serviceName: string, configs: ApiKeyConfig[]) {
    this.serviceName = serviceName;
    
    for (const config of configs) {
      if (config.key) {
        this.keys.set(config.key, {
          config,
          requestCount: 0,
          lastReset: Date.now(),
          isHealthy: true,
        });
        this.keyOrder.push(config.key);
      }
    }
  }

  /**
   * Get the next available API key using round-robin
   */
  getKey(): string | undefined {
    if (this.keyOrder.length === 0) return undefined;

    // Try to find a healthy key
    const startIndex = this.currentIndex;
    let attempts = 0;

    while (attempts < this.keyOrder.length) {
      const key = this.keyOrder[this.currentIndex];
      const state = this.keys.get(key);

      if (state?.isHealthy && !this.isRateLimited(state)) {
        // Move to next key for next request (round-robin)
        this.currentIndex = (this.currentIndex + 1) % this.keyOrder.length;
        return key;
      }

      this.currentIndex = (this.currentIndex + 1) % this.keyOrder.length;
      attempts++;
    }

    // All keys are rate-limited, return first one anyway
    return this.keyOrder[startIndex];
  }

  /**
   * Record successful API usage
   */
  recordUsage(key: string): void {
    const state = this.keys.get(key);
    if (state) {
      state.requestCount++;
      state.isHealthy = true;
      state.lastError = undefined;
    }
  }

  /**
   * Record API error (may trigger key rotation)
   */
  recordError(key: string, error: string): void {
    const state = this.keys.get(key);
    if (state) {
      state.lastError = error;
      
      // Mark unhealthy if rate limit error
      if (error.includes('rate') || error.includes('429') || error.includes('limit')) {
        state.isHealthy = false;
        
        // Reset health after 1 minute
        setTimeout(() => {
          state.isHealthy = true;
          state.requestCount = 0;
        }, 60000);
      }
    }
  }

  /**
   * Check if a key is rate-limited
   */
  private isRateLimited(state: KeyState): boolean {
    const config = state.config;
    const now = Date.now();

    // Reset count every second
    if (now - state.lastReset > 1000) {
      state.requestCount = 0;
      state.lastReset = now;
    }

    // Check per-second limit
    if (config.requestsPerSecond && state.requestCount >= config.requestsPerSecond) {
      return true;
    }

    return false;
  }

  /**
   * Get service status for debugging
   */
  getStatus(): { service: string; keys: Array<{ name: string; healthy: boolean; requests: number }> } {
    return {
      service: this.serviceName,
      keys: Array.from(this.keys.values()).map(state => ({
        name: state.config.name,
        healthy: state.isHealthy,
        requests: state.requestCount,
      })),
    };
  }
}

// ============================================================================
// Service-Specific Key Managers
// ============================================================================

/**
 * PubMed API key manager
 * Default: 3 requests/second without key, 10/second with key
 */
export const pubmedKeyManager = new ApiKeyManager('pubmed', [
  {
    key: process.env.NCBI_API_KEY || '',
    name: 'Primary NCBI',
    requestsPerSecond: 10,
  },
  {
    key: process.env.NCBI_API_KEY_2 || '',
    name: 'Secondary NCBI',
    requestsPerSecond: 10,
  },
  {
    key: '', // No key fallback (3/sec)
    name: 'No Key (Rate Limited)',
    requestsPerSecond: 3,
  },
].filter(c => c.key !== '' || c.name.includes('Fallback') || c.name.includes('No Key')));

/**
 * Firecrawl API key manager
 */
export const firecrawlKeyManager = new ApiKeyManager('firecrawl', [
  {
    key: process.env.FIRECRAWL_API_KEY || '',
    name: 'Primary Firecrawl',
    requestsPerSecond: 5,
  },
]);

/**
 * Semantic Scholar API key manager (free tier)
 */
export const semanticScholarKeyManager = new ApiKeyManager('semantic_scholar', [
  {
    key: process.env.SEMANTIC_SCHOLAR_API_KEY || '',
    name: 'Primary S2',
    requestsPerSecond: 100, // 100/sec for authenticated
  },
  {
    key: '',
    name: 'No Key (Rate Limited)',
    requestsPerSecond: 10, // 10/sec without key
  },
]);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get API key for a service with automatic rotation
 */
export function getApiKey(service: 'pubmed' | 'firecrawl' | 'semantic_scholar'): string | undefined {
  switch (service) {
    case 'pubmed':
      return pubmedKeyManager.getKey();
    case 'firecrawl':
      return firecrawlKeyManager.getKey();
    case 'semantic_scholar':
      return semanticScholarKeyManager.getKey();
    default:
      return undefined;
  }
}

/**
 * Record API usage for rate tracking
 */
export function recordApiUsage(
  service: 'pubmed' | 'firecrawl' | 'semantic_scholar',
  key: string,
  success: boolean,
  error?: string
): void {
  const manager = service === 'pubmed' 
    ? pubmedKeyManager 
    : service === 'firecrawl'
    ? firecrawlKeyManager
    : semanticScholarKeyManager;

  if (success) {
    manager.recordUsage(key);
  } else if (error) {
    manager.recordError(key, error);
  }
}
