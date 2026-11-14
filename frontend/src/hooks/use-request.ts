import { useEffect, useState } from 'react';

export type RequestState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: unknown };

type Settled<T> =
  | { source: unknown; ok: true; data: T }
  | { source: unknown; ok: false; error: unknown };

/**
 * Executa `load` sempre que a identidade da função muda (use `useCallback` no chamador).
 * Enquanto o resultado guardado não for o da função atual, o estado é `loading`.
 */
export function useRequest<T>(load: () => Promise<T>): RequestState<T> {
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => {
        if (!cancelled) setSettled({ source: load, ok: true, data });
      },
      (error: unknown) => {
        if (!cancelled) setSettled({ source: load, ok: false, error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (!settled || settled.source !== load) return { status: 'loading' };
  if (settled.ok === false) return { status: 'error', error: settled.error };
  return { status: 'success', data: settled.data };
}