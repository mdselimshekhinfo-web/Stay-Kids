/**
 * StayKids Global Application Configuration & Dynamic Environment Resolver
 */

// Single Centralized Feature Flag for Premium Paywall & Subscription Management.
export const PREMIUM_ENABLED = false

export function isPremiumUnlocked(isUserPremium?: boolean): boolean {
  if (!PREMIUM_ENABLED) return true
  return Boolean(isUserPremium)
}

interface AppConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  apiBaseUrl: string
  isSelfHosted: boolean
}

const getEnv = (key: string, fallback: string): string => {
  return (import.meta as any).env?.[key] || fallback
}

const supabaseUrl = getEnv("VITE_SUPABASE_URL", "https://your-project.supabase.co")
const supabaseAnonKey = getEnv("VITE_SUPABASE_ANON_KEY", "your-anon-key")

export const config: AppConfig = {
  supabaseUrl,
  supabaseAnonKey,
  apiBaseUrl: `${supabaseUrl}/functions/v1/server`,
  isSelfHosted: supabaseUrl.includes("localhost") || !supabaseUrl.includes("supabase.co"),
}
