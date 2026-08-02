/**
 * Dedicated Authentication Service Layer (authService.ts)
 * Abstracting Login, Signup, OTP, Password Reset, and Session Revocation
 */
import { request, setAuthToken } from "../lib/staykids-api"
import { authManager } from "../lib/auth-manager"
import { SignUpSchema, LoginSchema, OtpSchema, PasswordResetSchema } from "../lib/validation-schemas"

export interface AuthUser {
  id: string
  email: string
  name: string
}

export class AuthService {
  private static instance: AuthService

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService()
    }
    return AuthService.instance
  }

  /**
   * User Login with email & password validation
   */
  public async login(email: string, password: string): Promise<{ success: boolean; token?: string; user?: AuthUser; error?: string }> {
    const parseResult = LoginSchema.safeParse({ email, password })
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.errors[0]?.message || "Invalid login credentials format" }
    }

    try {
      const res = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify(parseResult.data),
      })
      if (res && res.token) {
        await setAuthToken(res.token)
        return { success: true, token: res.token, user: res.user }
      }
      return { success: false, error: res?.error || "Invalid credentials" }
    } catch (err: any) {
      return { success: false, error: err.message || "Login request failed" }
    }
  }

  /**
   * Account Signup with input validation
   */
  public async signup(name: string, email: string, password: string): Promise<{ success: boolean; token?: string; user?: AuthUser; error?: string }> {
    const parseResult = SignUpSchema.safeParse({ name, email, password })
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.errors[0]?.message || "Invalid signup input" }
    }

    try {
      const res = await request("/auth/signup", {
        method: "POST",
        body: JSON.stringify(parseResult.data),
      })
      if (res && res.token) {
        await setAuthToken(res.token)
        return { success: true, token: res.token, user: res.user }
      }
      return { success: false, error: res?.error || "Registration failed" }
    } catch (err: any) {
      return { success: false, error: err.message || "Signup request failed" }
    }
  }

  /**
   * Verify 6-digit OTP Code
   */
  public async verifyOtp(email: string, otp: string): Promise<{ success: boolean; token?: string; user?: AuthUser; error?: string }> {
    const parseResult = OtpSchema.safeParse({ email, otp })
    if (!parseResult.success) {
      return { success: false, error: "6-digit OTP code is required" }
    }

    try {
      const res = await request("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify(parseResult.data),
      })
      if (res && res.token) {
        await setAuthToken(res.token)
        return { success: true, token: res.token, user: res.user }
      }
      return { success: false, error: res?.error || "Invalid or expired OTP code" }
    } catch (err: any) {
      return { success: false, error: err.message || "OTP verification failed" }
    }
  }

  /**
   * Request Forgot Password Reset OTP
   */
  public async forgotPassword(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await request("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      })
      return { success: !!res?.success, message: res?.message, error: res?.error }
    } catch (err: any) {
      return { success: false, error: err.message || "Password reset request failed" }
    }
  }

  /**
   * Confirm Password Reset with OTP & New Password
   */
  public async resetPassword(email: string, otp: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    const parseResult = PasswordResetSchema.safeParse({ email, otp, newPassword })
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.errors[0]?.message || "Invalid password reset details" }
    }

    try {
      const res = await request("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(parseResult.data),
      })
      return { success: !!res?.success, error: res?.error }
    } catch (err: any) {
      return { success: false, error: err.message || "Password reset execution failed" }
    }
  }

  /**
   * Sign Out & Invalidate Session Tokens
   */
  public async logout(): Promise<void> {
    await setAuthToken(null)
    await authManager.clearSession()
  }
}

export const authService = AuthService.getInstance()
