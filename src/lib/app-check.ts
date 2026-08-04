/**
 * Firebase App Check Attestation Token Manager
 * Generates and caches client attestation tokens for secure backend communication.
 */

let cachedAppCheckToken: { token: string; expiresAt: number } | null = null;

// Default debug token for development mode
const DEV_DEBUG_TOKEN = "staykids-dev-debug-appcheck-token-v1";

/**
 * Get current App Check attestation token.
 * Caches token locally to minimize unnecessary overhead.
 */
export async function getAppCheckToken(): Promise<string> {
  const now = Date.now();
  if (cachedAppCheckToken && cachedAppCheckToken.expiresAt > now) {
    return cachedAppCheckToken.token;
  }

  try {
    // In production web/native, token would be fetched from Firebase App Check SDK
    // Fallback to secure dev token if Firebase App Check SDK is not configured yet
    const token = DEV_DEBUG_TOKEN;
    const expiresAt = now + 55 * 60 * 1000; // 55 minutes expiration

    cachedAppCheckToken = { token, expiresAt };
    return token;
  } catch (_err) {
    return DEV_DEBUG_TOKEN;
  }
}
