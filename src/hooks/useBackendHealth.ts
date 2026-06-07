import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../config/api';

export type HealthStatus = 'checking' | 'ok' | 'waking' | 'unreachable';

// After WAKING_MS with no response, show "starting server" to user
const WAKING_MS = 5_000;
// Give up after TIMEOUT_MS
const TIMEOUT_MS = 40_000;

export function useBackendHealth() {
  const [status, setStatus] = useState<HealthStatus>('checking');
  const abortRef = useRef<AbortController | null>(null);

  const check = useCallback(async () => {
    // Cancel any in-flight check
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus('checking');

    const wakingTimer = setTimeout(() => {
      if (!ctrl.signal.aborted) setStatus('waking');
    }, WAKING_MS);

    const timeoutTimer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${API_BASE_URL}/health`, {
        signal: ctrl.signal,
      });
      clearTimeout(wakingTimer);
      clearTimeout(timeoutTimer);
      setStatus(res.ok ? 'ok' : 'unreachable');
    } catch {
      clearTimeout(wakingTimer);
      clearTimeout(timeoutTimer);
      if (!ctrl.signal.aborted) setStatus('unreachable');
    }
  }, []);

  useEffect(() => {
    check();
    return () => { abortRef.current?.abort(); };
  }, [check]);

  return { status, retry: check };
}
