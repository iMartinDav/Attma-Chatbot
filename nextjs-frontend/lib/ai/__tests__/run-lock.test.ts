import { createRunLock, RUN_LOCK_STALE_MS } from '../run-lock';

describe('run lock', () => {
  it('acquires a free chat and refuses a second run', () => {
    const lock = createRunLock();
    expect(lock.acquire('chat-1', 1_000)).toBe(true);
    expect(lock.acquire('chat-1', 2_000)).toBe(false);
    expect(lock.acquire('chat-2', 2_000)).toBe(true);
  });

  it('frees the chat on release', () => {
    const lock = createRunLock();
    lock.acquire('chat-1', 1_000);
    lock.release('chat-1');
    expect(lock.acquire('chat-1', 2_000)).toBe(true);
  });

  it('treats a lock older than the stale limit as free', () => {
    const lock = createRunLock();
    lock.acquire('chat-1', 1_000);
    expect(lock.acquire('chat-1', 1_000 + RUN_LOCK_STALE_MS - 1)).toBe(false);
    expect(lock.acquire('chat-1', 1_000 + RUN_LOCK_STALE_MS)).toBe(true);
  });
});
