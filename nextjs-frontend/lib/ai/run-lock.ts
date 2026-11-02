// A lock older than the route's maxDuration cannot still be running, so it is treated as free instead of locking the chat until a restart.
export const RUN_LOCK_STALE_MS = 300_000;

export interface RunLock {
  acquire(chatId: string, now: number): boolean;
  release(chatId: string): void;
}

export function createRunLock(): RunLock {
  const starts = new Map<string, number>();
  return {
    acquire(chatId, now) {
      const startedAt = starts.get(chatId);
      if (startedAt !== undefined && now - startedAt < RUN_LOCK_STALE_MS) {
        return false;
      }
      starts.set(chatId, now);
      return true;
    },
    release(chatId) {
      starts.delete(chatId);
    },
  };
}

/** The one lock for this server instance, shared by every chat request it serves. */
export const chatRunLock = createRunLock();
