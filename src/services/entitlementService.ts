import { apiFetch } from './apiClient';

export type EntitlementStatus = 'trialing' | 'expired' | 'active';

export type Entitlement = {
  status: EntitlementStatus;
  trialStartedAt: string;
  trialEndsAt: string;
  canUseApp: boolean;
  canUseCoach: boolean;
  coachMessagesRemaining: number;
  coachMessagesLimit: number;
  coachMessagesResetAt: string;
  canUseScrape: boolean;
};

export async function fetchEntitlement(): Promise<Entitlement> {
  const res = await apiFetch('/entitlements/me');
  if (!res.ok) throw new Error(`Entitlement fetch failed: ${res.status}`);
  return res.json() as Promise<Entitlement>;
}
