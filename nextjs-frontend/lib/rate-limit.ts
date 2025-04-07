/**
 * Basic in-memory rate limiting implementation.
 * For production, consider using a Redis-backed solution.
 */
export function rateLimit({
  interval = 60 * 1000, // 1 minute
  maxRequests = 10, // default max requests per interval
  uniqueTokenPerInterval = 500,
} = {}) {
  const tokenCache = new Map();

  return {
    /**
     * Check if a request is within rate limits
     * @param limit - Maximum number of allowed requests in the time window
     * @param token - Unique identifier for the requester (e.g., IP, user ID)
     * @returns - Promise that resolves if under limit, rejects if rate limited
     */
    check: (limit: number, token: string): Promise<void> => {
      const now = Date.now();
      const requests = tokenCache.get(token) || [];

      // Filter to only include requests within the current interval
      const recentRequests: number[] = requests.filter(
        (timestamp: number) => timestamp > now - interval,
      );

      // Check if the rate limit would be exceeded
      if (recentRequests.length >= (limit || maxRequests)) {
        return Promise.reject(new Error('Rate limit exceeded'));
      }

      // Add the current request timestamp
      recentRequests.push(now);
      tokenCache.set(token, recentRequests);

      // Clean up old tokens to prevent memory leaks
      if (tokenCache.size > uniqueTokenPerInterval) {
        // Get the oldest tokens and remove them
        const oldestTokens = [...tokenCache.keys()]
          .sort((a, b) => {
            const aTimestamp = Math.min(...(tokenCache.get(a) || [0]));
            const bTimestamp = Math.min(...(tokenCache.get(b) || [0]));
            return aTimestamp - bTimestamp;
          })
          .slice(0, Math.floor(uniqueTokenPerInterval * 0.1)); // Remove oldest 10%

        for (const oldToken of oldestTokens) {
          tokenCache.delete(oldToken);
        }
      }

      return Promise.resolve();
    },
  };
}
