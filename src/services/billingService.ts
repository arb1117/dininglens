/**
 * Billing service stub.
 * PROTOTYPE — no payment provider wired yet.
 * In production, integrate react-native-purchases (RevenueCat) or
 * expo-in-app-purchases here.
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

const PLANS: Plan[] = [
  {
    id: 'dininglens_pro_monthly',
    name: 'DiningLens Pro',
    priceMonthly: 4.99,
    currency: 'USD',
    features: [
      'Unlimited AI meal analysis',
      'Unlimited AI coach messages',
      'Advanced macro tracking',
      'Restaurant menu scraping',
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
