# Billing Architecture

## Current state (prototype)

Entitlements are enforced server-side via an in-memory store (`server/services/entitlementService.js`). All devices begin a free trial on first request. No payment provider is integrated yet; the "Subscribe" CTA in the app is disabled.

## Planned production stack

| Layer | Component | Notes |
|---|---|---|
| Client SDK | react-native-purchases (RevenueCat) | Handles StoreKit / Google Play Billing, receipt validation |
| Backend webhook | RevenueCat → `POST /webhooks/revenuecat` | Updates entitlement store on purchase, renewal, cancellation |
| Entitlement store | PostgreSQL (`entitlements` table) | Replaces in-memory Map; keyed on `install_id` |
| Restore flow | `billingService.syncPurchases()` | Called on app foreground after reinstall |

## Integration checklist

- [ ] Install `react-native-purchases` and configure App Store / Play Store products
- [ ] Replace in-memory entitlement store with DB-backed store
- [ ] Add `POST /webhooks/revenuecat` route with HMAC signature verification
- [ ] Wire `billingService.startSubscription()` to RevenueCat `purchasePackage()`
- [ ] Wire `billingService.syncPurchases()` to RevenueCat `restorePurchases()`
- [ ] Wire `billingService.getSubscriptionStatus()` to RevenueCat `getCustomerInfo()`
- [ ] Enable "Subscribe" button in `PaywallPlaceholder.tsx`
- [ ] Add subscription management deep-link (Apple / Google manage subscription pages)

## Security notes

- Never trust client-reported entitlement status; always validate server-side via entitlement service.
- RevenueCat webhook must verify the `X-RevenueCat-Signature` header before updating entitlements.
- Install ID is anonymous; do not log or expose it in user-facing responses.
