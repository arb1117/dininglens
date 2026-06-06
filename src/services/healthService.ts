/**
 * HealthKit integration stub
 *
 * TODO: HealthKit requires bare (ejected) workflow or an EAS custom dev build.
 *       Neither `react-native-health` nor `@kingstinct/react-native-healthkit` is
 *       available in Expo Go / managed SDK 54 — they need native iOS modules that
 *       can't be shimmed without a custom build.
 *
 * To implement for real:
 *   1. Run `npx expo eject` (or use EAS Build with a config plugin).
 *   2. Add `react-native-health` and follow its Xcode / Info.plist setup.
 *   3. Replace the stubs below with real API calls.
 *   4. Add `NSHealthShareUsageDescription` and `NSHealthUpdateUsageDescription`
 *      to ios/<App>/Info.plist.
 */

export type HealthMacros = {
  calories: number;
  protein:  number;
  carbs:    number;
  fat:      number;
};

/** Always false in managed Expo workflow. */
export const HEALTHKIT_AVAILABLE = false;

/**
 * Request HealthKit write permission.
 * Returns false in managed workflow — HealthKit is unavailable.
 */
export async function requestHealthPermission(): Promise<boolean> {
  return false;
}

/**
 * Write a dietary sample to HealthKit.
 * No-op in managed workflow — HealthKit is unavailable.
 */
export async function logMacrosToHealth(_macros: HealthMacros): Promise<boolean> {
  return false;
}
