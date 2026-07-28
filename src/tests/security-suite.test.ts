/**
 * Security & Validation Comprehensive Test Suite
 */
import {
  sanitizeInput,
  sanitizeEmail,
  SignUpSchema,
  OtpSchema,
  PairingClaimSchema,
} from '../lib/validation-schemas'
import { encryptData, decryptData } from '../lib/crypto'
import { RateLimiter } from '../../supabase/functions/server/security'

export async function runSecurityTestSuite(): Promise<{ passed: boolean; results: string[] }> {
  const results: string[] = []
  let passed = true

  function assert(condition: boolean, testName: string) {
    if (condition) {
      results.push(`✅ PASSED: ${testName}`)
    } else {
      passed = false
      results.push(`❌ FAILED: ${testName}`)
    }
  }

  // 1. Input Sanitization Tests
  const xssString = '<script>alert("XSS")</script>'
  const sanitized = sanitizeInput(xssString)
  assert(sanitized === '&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;', 'XSS Input Sanitization')

  const rawEmail = '  USER.NAME@EXAMPLE.COM   '
  assert(sanitizeEmail(rawEmail) === 'user.name@example.com', 'Email Trimming & Lowercasing')

  // 2. Zod Validation Schema Tests
  const validSignup = SignUpSchema.safeParse({
    name: 'Parent User',
    email: 'parent@example.com',
    password: 'securePassword123',
  })
  assert(validSignup.success, 'Zod Valid Signup Parsing')

  const invalidSignup = SignUpSchema.safeParse({
    email: 'not-an-email',
    password: '123',
  })
  assert(!invalidSignup.success, 'Zod Invalid Signup Rejection')

  const validOtp = OtpSchema.safeParse({
    email: 'parent@example.com',
    otp: '123456',
  })
  assert(validOtp.success, 'Zod 6-Digit OTP Schema Validation')

  const invalidOtp = OtpSchema.safeParse({
    email: 'parent@example.com',
    otp: 'abc12',
  })
  assert(!invalidOtp.success, 'Zod Invalid OTP Rejection')

  const validPairing = PairingClaimSchema.safeParse({
    pin: '987654',
    deviceName: 'Child Tablet',
  })
  assert(validPairing.success, 'Zod Pairing Claim Schema Validation')

  // 3. AES-256 Web Crypto Tests
  const secretPayload = JSON.stringify({ action: 'trigger-sos', timestamp: Date.now() })
  const encrypted = await encryptData(secretPayload)
  assert(encrypted !== secretPayload && encrypted.length > 0, 'AES-256 GCM Encryption')

  const decrypted = await decryptData(encrypted)
  assert(decrypted === secretPayload, 'AES-256 GCM Decryption Integrity')

  // 4. Rate Limiter Tests
  const limiter = new RateLimiter()
  const key = 'test-ip-127.0.0.1'
  let rateAllowed = true
  for (let i = 0; i < 5; i++) {
    rateAllowed = limiter.isAllowed(key, 5, 60000)
  }
  assert(rateAllowed === true, 'Rate Limiter allows up to 5 requests')

  const rateBlocked = limiter.isAllowed(key, 5, 60000)
  assert(rateBlocked === false, 'Rate Limiter blocks 6th request (429 Protection)')

  return { passed, results }
}
