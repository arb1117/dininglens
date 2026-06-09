/**
 * Billing service stub.
 * PROTOTYPE — no payment provider wired yet.
 * In production, integrate react-native-purchases (RevenueCat) here.
 */

export type Plan = {
  id: string;
  name: string;
  priceMonthly: number;
  currency: string;
  features: string[];
};

export type SubscriptionStatus = {
  isActive: boolean;
  planId: string | null;
  expiresAt: string | null;
};

// Price and feature list are placeholders — final pricing TBD before launch.
const PLANS: Plan[] = [
  {
    id: 'dininglens_pro_monthly',
    name: 'DiningLens Pro',
    priceMonthly: 0, // placeholder — final price TBD
    currency: 'USD',
    features: [
      'Full AI meal analysis',
      'Daily AI coach messages',
      'Advanced macro tracking',
      'Restaurant menu scanning',
    ],
  },
];

export async function getAvailablePlans(): Promise<Plan[]> {
  // TODO: fetch from payment provider SDK (e.g. RevenueCat offerings)
  return PLANS;
}

export async function startSubscription(_planId: string): Promise<void> {
  // TODO: launch payment flow via payment provider SDK
  throw new Error('Subscription purchasing is not yet available.');
}

export async function syncPurchases(): Promise<void> {
  // TODO: call payment provider restorePurchases() to sync entitlements
  // after reinstall or device change
}

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  // TODO: query payment provider for active subscription
  return { isActive: false, planId: null, expiresAt: null };
}
