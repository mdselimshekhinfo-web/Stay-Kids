import { z } from 'zod'

/**
 * XSS & HTML Input Sanitizer
 */
export function sanitizeInput(input: string): string {
  if (!input) return ''
  return input
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

// Strong Password Validation: Min 10 chars, 1 uppercase, 1 lowercase, 1 number
const StrongPasswordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')

// 1. Auth Schemas
export const SignUpSchema = z.object({
  name: z.string().transform(sanitizeInput).optional(),
  email: z.string().email('Invalid email address format').transform(sanitizeEmail),
  password: StrongPasswordSchema,
})

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address format').transform(sanitizeEmail),
  password: z.string().min(1, 'Password is required'),
})

export const OtpSchema = z.object({
  email: z.string().email('Invalid email address format').transform(sanitizeEmail),
  otp: z.string().length(6, 'OTP code must be exactly 6 digits').regex(/^\d+$/, 'OTP must contain only numbers'),
})

export const PasswordResetSchema = z.object({
  email: z.string().email('Invalid email address format').transform(sanitizeEmail),
  otp: z.string().length(6, 'OTP code must be exactly 6 digits').regex(/^\d+$/, 'OTP must contain only numbers'),
  newPassword: StrongPasswordSchema,
})

// 2. Pairing Schemas
export const PairingClaimSchema = z.object({
  pin: z.string().length(6, 'Pairing PIN must be 6 digits').regex(/^\d+$/, 'PIN must contain only numbers'),
  deviceName: z.string().transform(sanitizeInput).optional(),
})

// 3. Action Schema
export const ActionSchema = z.object({
  type: z.string().min(1, 'Action type is required'),
  source: z.string().optional(),
  childId: z.string().optional(),
  limit: z.number().min(0).max(1440).optional(),
  app: z.string().optional(),
  active: z.boolean().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  frame: z.string().optional(),
})

export type SignUpInput = z.infer<typeof SignUpSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type OtpInput = z.infer<typeof OtpSchema>
export type PasswordResetInput = z.infer<typeof PasswordResetSchema>
export type PairingClaimInput = z.infer<typeof PairingClaimSchema>
export type ActionInput = z.infer<typeof ActionSchema>
