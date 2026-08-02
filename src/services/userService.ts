/**
 * User & Child Management Service Layer (userService.ts)
 * Abstracting user settings, child management, session revocation, and device unpairing
 */
import { request } from "../lib/staykids-api"

export class UserService {
  private static instance: UserService

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService()
    }
    return UserService.instance
  }

  /**
   * Revoke all active sessions (multi-device logout & token invalidation)
   */
  public async revokeAllSessions(): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await request("/user/revoke-sessions", {
        method: "POST",
      })
      return { success: !!res?.success, error: res?.error }
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to revoke active sessions" }
    }
  }

  /**
   * Change user password
   */
  public async changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await request("/user/change-password", {
        method: "POST",
        body: JSON.stringify({ oldPassword, newPassword }),
      })
      return { success: !!res?.success, message: res?.message, error: res?.error }
    } catch (err: any) {
      return { success: false, error: err.message || "Password update failed" }
    }
  }

  /**
   * Unpair a child device
   */
  public async unpairChildDevice(childId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await request("/action", {
        method: "POST",
        body: JSON.stringify({ type: "unpair-device", childId }),
      })
      return { success: !!res?.success, error: res?.error }
    } catch (err: any) {
      return { success: false, error: err.message || "Device unpairing failed" }
    }
  }
}

export const userService = UserService.getInstance()
