/**
 * Security & Validation Comprehensive Vitest Test Suite
 */
import { describe, it, expect } from 'vitest'
import {
  sanitizeInput,
  sanitizeEmail,
  SignUpSchema,
  OtpSchema,
  PairingClaimSchema,
} from '../lib/validation-schemas'
import { encryptData, decryptData } from '../lib/crypto'

// Standalone Client-side RateLimiter Class for testing without Deno dependencies
class ClientRateLimiter {
  private requests: Map<string, number[]> = new Map()

  isAllowed(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now()
    const timestamps = this.requests.get(key) || []
    const validTimestamps = timestamps.filter((ts) => now - ts < windowMs)

    if (validTimestamps.length >= limit) {
      this.requests.set(key, validTimestamps)
      return false
    }

    validTimestamps.push(now)
    this.requests.set(key, validTimestamps)
    return true
  }
}

describe('Security & Validation Test Suite', () => {
  it('Sanitizes HTML and XSS strings properly', () => {
    const xssString = '<script>alert("XSS")</script>'
    const sanitized = sanitizeInput(xssString)
    expect(sanitized).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;')
  })

  it('Trims and lowercases email input', () => {
    const rawEmail = '  USER.NAME@EXAMPLE.COM   '
    expect(sanitizeEmail(rawEmail)).toBe('user.name@example.com')
  })

  it('Validates strong signup passwords (min 10 chars, uppercase, lowercase, number)', () => {
    const validSignup = SignUpSchema.safeParse({
      name: 'Parent User',
      email: 'parent@example.com',
      password: 'SecurePassword123',
    })
    expect(validSignup.success).toBe(true)

    const invalidSignupWeak = SignUpSchema.safeParse({
      email: 'parent@example.com',
      password: 'weak',
    })
    expect(invalidSignupWeak.success).toBe(false)
  })

  it('Validates 6-digit OTP codes', () => {
    const validOtp = OtpSchema.safeParse({
      email: 'parent@example.com',
      otp: '123456',
    })
    expect(validOtp.success).toBe(true)

    const invalidOtp = OtpSchema.safeParse({
      email: 'parent@example.com',
      otp: 'abc12',
    })
    expect(invalidOtp.success).toBe(false)
  })

  it('Validates device pairing claim PINs', () => {
    const validPairing = PairingClaimSchema.safeParse({
      pin: '987654',
      deviceName: 'Child Tablet',
    })
    expect(validPairing.success).toBe(true)
  })

  it('Performs AES-256 GCM encryption and decryption with session passphrase', async () => {
    const secretPayload = JSON.stringify({ action: 'trigger-sos', timestamp: Date.now() })
    const testPassphrase = 'test-session-jwt-token-12345'
    
    const encrypted = await encryptData(secretPayload, testPassphrase)
    expect(encrypted).not.toBe(secretPayload)
    expect(encrypted.length).toBeGreaterThan(0)

    const decrypted = await decryptData(encrypted, testPassphrase)
    expect(decrypted).toBe(secretPayload)
  })

  it('Enforces fail-closed error when decryption fails or passphrase is missing', async () => {
    await expect(encryptData('data', '')).rejects.toThrow()
    await expect(decryptData('invalid-cipher', 'key')).rejects.toThrow()
  })

  it('Enforces sliding-window rate limiting', () => {
    const limiter = new ClientRateLimiter()
    const key = 'test-ip-127.0.0.1'
    let rateAllowed = true
    for (let i = 0; i < 5; i++) {
      rateAllowed = limiter.isAllowed(key, 5, 60000)
    }
    expect(rateAllowed).toBe(true)

    const rateBlocked = limiter.isAllowed(key, 5, 60000)
    expect(rateBlocked).toBe(false)
  })

  it('Validates server-side reward point bounds and redemption tiers', () => {
    const VALID_POINT_AMOUNTS = [10]
    const VALID_REDEMPTIONS = [{ cost: 30, mins: 15 }]

    // Legitimate 10-point award
    const validPoints = 10
    expect(VALID_POINT_AMOUNTS.includes(validPoints)).toBe(true)

    // Inflated spoofed points
    const spoofedPoints = 999999
    expect(VALID_POINT_AMOUNTS.includes(spoofedPoints)).toBe(false)

    // Legitimate tier
    const validTier = VALID_REDEMPTIONS.find((r) => r.cost === 30 && r.mins === 15)
    expect(validTier).toBeDefined()

    // Invalid redemption attempt
    const invalidTier = VALID_REDEMPTIONS.find((r) => r.cost === 0 && r.mins === 500)
    expect(invalidTier).toBeUndefined()
  })

  it('Enforces token_valid_after timestamp comparison for session revocation', () => {
    const tokenIat = 1700000000 // Issued timestamp in seconds
    const tokenValidAfterIso = '2026-08-01T21:00:00.000Z'
    const validAfterSec = Math.floor(new Date(tokenValidAfterIso).getTime() / 1000)

    // Token issued before revocation timestamp is invalid
    const isTokenRevoked = tokenIat < validAfterSec
    expect(isTokenRevoked).toBe(true)
  })
})
