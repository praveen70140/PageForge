'use client';

import { useState, useEffect, useCallback } from 'react';

interface FetchState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refetch: () => void;
}

/**
 * Generic fetch hook for GET requests.
 */
export function useFetch<T>(url: string): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({ error: 'Request failed' }))) as { error?: string };
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json() as Promise<T>;
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url, tick]);

  return { data, error, loading, refetch };
}

/**
 * Mutation hook for POST/PUT/PATCH/DELETE requests.
 */
export function useMutation<TInput, TOutput = unknown>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST'
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = async (data?: TInput): Promise<TOutput | null> => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: data !== undefined ? JSON.stringify(data) : undefined,
      });

      const json = (await res.json()) as TOutput & { error?: string };

      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      setLoading(false);
      return json;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed';
      setError(message);
      setLoading(false);
      return null;
    }
  };

  return { mutate, loading, error };
}
