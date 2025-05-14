import { useEffect, useState, useRef } from 'react';

interface BioflowTaskStatus {
  status: string;
  result?: unknown;
  error?: string;
  isLoading: boolean;
}

/**
 * Polls the backend for the status of a bioflow analysis task.
 * @param taskId The task ID returned from the backend after upload
 * @param pollIntervalMs How often to poll (default: 2000ms)
 */
export function useBioflowTaskStatus(
  taskId?: string,
  pollIntervalMs = 2000,
): BioflowTaskStatus {
  const [status, setStatus] = useState<string>('pending');
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(!!taskId);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!taskId) return;
    setIsLoading(true);
    setError(undefined);
    setResult(null);
    setStatus('pending');

    async function fetchStatus() {
      try {
        const res = await fetch(`/api/bioflow/task-status?id=${taskId}`);
        if (!res.ok) throw new Error(`Status fetch failed: ${res.status}`);
        const data = await res.json();
        setStatus(data.status);
        setResult(data.result);
        if (data.status === 'completed' || data.status === 'failed') {
          setIsLoading(false);
          if (data.status === 'failed') setError(data.error || 'Task failed');
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Unknown error');
        }
        setIsLoading(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }

    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, pollIntervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [taskId, pollIntervalMs]);

  return { status, result, error, isLoading };
}
