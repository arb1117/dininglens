import { useState, useEffect, useCallback } from 'react';
import { fetchEntitlement, type Entitlement } from '../services/entitlementService';

type UseEntitlementResult = {
  loading: boolean;
  entitlement: Entitlement | null;
  error: string | null;
  refresh: () => void;
};

export function useEntitlement(): UseEntitlementResult {
  const [loading, setLoading]           = useState(true);
  const [entitlement, setEntitlement]   = useState<Entitlement | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [tick, setTick]                 = useState(0);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchEntitlement()
      .then(data => { if (!cancelled) { setEntitlement(data); setLoading(false); } })
      .catch(err  => { if (!cancelled) { setError(err.message ?? 'Unknown error'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [tick]);

  return { loading, entitlement, error, refresh };
}
