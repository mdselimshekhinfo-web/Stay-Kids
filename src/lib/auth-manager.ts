import { Preferences } from '@capacitor/preferences'

export interface UserSession {
  email: string
  name: string
  role: 'parent' | 'device'
  token: string
  expiresAt: number
}

const TOKEN_KEY = 'staykids_jwt_token'
const SESSION_KEY = 'staykids_user_session'

class AuthManager {
  private currentSession: UserSession | null = null

  async init(): Promise<UserSession | null> {
    try {
      const { value: sessionStr } = await Preferences.get({ key: SESSION_KEY })
      if (sessionStr) {
        const session: UserSession = JSON.parse(sessionStr)
        if (session.expiresAt > Date.now()) {
          this.currentSession = session
          await Preferences.set({ key: TOKEN_KEY, value: session.token })
          return session
        } else {
          await this.clearSession()
        }
      }
    } catch (_e) {
      await this.clearSession()
    }
    return null
  }

  async setSession(user: { name: string; email: string }, token: string, role: 'parent' | 'device' = 'parent'): Promise<UserSession> {
    // Standard JWT 7-day expiration calculation
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000
    const session: UserSession = {
      email: user.email,
      name: user.name,
      role,
      token,
      expiresAt,
    }

    this.currentSession = session
    await Preferences.set({ key: TOKEN_KEY, value: token })
    await Preferences.set({ key: SESSION_KEY, value: JSON.stringify(session) })
    return session
  }

  getSession(): UserSession | null {
    if (this.currentSession && this.currentSession.expiresAt > Date.now()) {
      return this.currentSession
    }
    return null
  }

  async getToken(): Promise<string | null> {
    if (this.currentSession && this.currentSession.expiresAt > Date.now()) {
      return this.currentSession.token
    }
    const { value } = await Preferences.get({ key: TOKEN_KEY })
    return value
  }

  async clearSession(): Promise<void> {
    this.currentSession = null
    await Preferences.remove({ key: TOKEN_KEY })
    await Preferences.remove({ key: SESSION_KEY })
  }

  isSessionValid(): boolean {
    return !!this.currentSession && this.currentSession.expiresAt > Date.now()
  }
}

export const authManager = new AuthManager()
