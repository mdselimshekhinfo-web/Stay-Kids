/**
 * StayKids Global Application Configuration & Feature Flags
 */

// Single Centralized Feature Flag for Premium Paywall & Subscription Management.
// Set to `false` for personal family use (all features 100% unlocked, paywalls/billing UI hidden).
// Set to `true` when ready to integrate real payment gateways (bKash/Nagad) and commercial paywalls.
export const PREMIUM_ENABLED = false

/**
 * Returns true if premium features are accessible to the user.
 * Short-circuits to true when PREMIUM_ENABLED is false.
 */
export function isPremiumUnlocked(isUserPremium?: boolean): boolean {
  if (!PREMIUM_ENABLED) return true
  return Boolean(isUserPremium)
}
