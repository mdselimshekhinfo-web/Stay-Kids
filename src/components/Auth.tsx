import React, { useEffect, useState } from "react"
import {
  signUpParent,
  loginParent,
  verifyEmailOtp,
  resendEmailOtp,
  requestPasswordReset,
  confirmPasswordReset,
} from "../lib/staykids-api"
import { LegalModal } from "./LegalModal"

export function Auth({ onAuthenticate }: { onAuthenticate: (user: { name: string; email: string }) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("signup")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [showLegal, setShowLegal] = useState(false)
  const [legalTab, setLegalTab] = useState<"terms" | "privacy">("terms")
  const [loading, setLoading] = useState(false)

  // Email OTP Verification State
  const [otpStep, setOtpStep] = useState(false)
  const [otpCode, setOtpCode] = useState("")
  const [otpMsg, setOtpMsg] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError("Please fill in all required fields.")
      return
    }
    if (mode === "signup" && password.length < 8) {
      setError("Password must be at least 8 characters long.")
      return
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    setError("")
    setLoading(true)
    try {
      if (mode === "signup") {
        const res = await signUpParent({ name, email, password })
        if (res.error) throw new Error(res.error)
        if (res.requiresOtp) {
          setOtpStep(true)
          if (res.message) setOtpMsg(res.message)
          return
        }
        onAuthenticate(res.user || { name: name || email.split("@")[0], email })
      } else {
        const res = await loginParent({ email, password })
        if (res.error) throw new Error(res.error)
        onAuthenticate(res.user || { name: email.split("@")[0], email })
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed. Please check your network and credentials.")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otpCode || otpCode.length !== 6) {
      setError("Please enter the 6-digit OTP code sent to your email.")
      return
    }
    setError("")
    setLoading(true)
    try {
      const res = await verifyEmailOtp({ email, otp: otpCode })
      if (res.error) throw new Error(res.error)
      onAuthenticate(res.user || { name: name || email.split("@")[0], email })
    } catch (err: any) {
      setError(err.message || "OTP verification failed. Please check the code and try again.")
    } finally {
      setLoading(false)
    }
  }

  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return
    setError("")
    setLoading(true)
    try {
      const res = await resendEmailOtp({ email })
      if (res.error) throw new Error(res.error)
      setOtpMsg(`New 6-digit OTP code sent to ${email}`)
      setResendCooldown(30)
    } catch (err: any) {
      setError(err.message || "Failed to resend OTP.")
    } finally {
      setLoading(false)
    }
  }

  // Forgot Password / Password Reset State
  const [forgotStep, setForgotStep] = useState(false)
  const [resetStep, setResetStep] = useState(false)
  const [resetOtpCode, setResetOtpCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")

  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      setError("Please enter your registered email address.")
      return
    }
    setError("")
    setLoading(true)
    try {
      const res = await requestPasswordReset({ email })
      if (res.error) throw new Error(res.error)
      setResetStep(true)
      if (res.message) setOtpMsg(res.message)
    } catch (err: any) {
      setError(err.message || "Failed to request password reset. Please check your email.")
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetOtpCode || resetOtpCode.length !== 6 || !newPassword || !confirmNewPassword) {
      setError("Please enter the 6-digit OTP code and a new password.")
      return
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.")
      return
    }
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.")
      return
    }
    setError("")
    setLoading(true)
    try {
      const res = await confirmPasswordReset({ email, otp: resetOtpCode, newPassword })
      if (res.error) throw new Error(res.error)
      onAuthenticate(res.user || { name: email.split("@")[0], email })
    } catch (err: any) {
      setError(err.message || "Failed to reset password. Please verify the OTP code.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#dfe8df] p-4 font-sans text-[#172226]">
      <LegalModal isOpen={showLegal} onClose={() => setShowLegal(false)} initialTab={legalTab} />
      <section className="relative w-full max-w-[480px] overflow-hidden rounded-[36px] bg-[#f8fbfb] p-7 shadow-2xl sm:p-9">
        <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-[#d6f4ad]" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-xl font-bold tracking-[-.04em]">
              stay<span className="text-[#287555]">kids</span>
            </p>
            <span className="rounded-full bg-[#edf3ef] px-3 py-1 text-xs font-bold text-[#287555]">
              {mode === "login" ? "Parent Login" : "Account Setup"}
            </span>
          </div>

          {forgotStep ? (
            <div className="mt-8 space-y-5">
              <div>
                <span className="rounded-full bg-[#f3faee] border border-[#cbe2d4] px-3 py-1 text-xs font-bold text-[#287555]">
                  🔑 Password Recovery (পাসওয়ার্ড রিসেট)
                </span>
                <h1 className="mt-3 text-3xl font-bold tracking-[-.05em]">Reset Password</h1>
                <p className="mt-2 text-xs leading-5 text-[#71807a]">
                  {!resetStep
                    ? "Enter your registered email address to receive a 6-digit password reset OTP code."
                    : `Enter the 6-digit reset OTP sent to ${email} and your new password.`}
                </p>
              </div>

              {otpMsg && <div className="rounded-xl bg-[#f3faee] p-3 text-xs font-bold text-[#287555] border border-[#cbe2d4]">{otpMsg}</div>}
              {error && <div className="rounded-xl bg-[#feebee] p-3 text-xs font-bold text-[#c62828] border border-[#ffcdd2]">{error}</div>}

              {!resetStep ? (
                <form onSubmit={handleRequestPasswordReset} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[.1em] text-[#71807a] mb-1.5">Registered Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ava.morgan@staykids.family"
                      className="w-full rounded-2xl border border-[#d8e2df] bg-white px-4 py-3.5 text-sm font-semibold text-[#172226] focus:border-[#287555] focus:outline-none focus:ring-2 focus:ring-[#287555]/20"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-2xl bg-[#287555] py-4 text-sm font-bold text-white hover:bg-[#1f5c43] shadow-md transition"
                  >
                    {loading ? "Sending Reset OTP..." : "Send Reset OTP Code →"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep(false)
                      setError("")
                    }}
                    className="w-full text-center text-xs font-bold text-[#71807a] hover:underline"
                  >
                    ← Back to Sign In
                  </button>
                </form>
              ) : (
                <form onSubmit={handleConfirmPasswordReset} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-[#172226]">6-Digit Reset OTP Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={resetOtpCode}
                      onChange={(e) => setResetOtpCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="Enter 6-digit OTP"
                      className="mt-1.5 w-full text-center tracking-[.3em] font-mono text-2xl font-bold rounded-2xl border border-[#d5deda] bg-white py-3.5 text-[#287555] focus:outline-none focus:ring-2 focus:ring-[#287555]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[.1em] text-[#71807a] mb-1.5">New Password <span className="normal-case font-normal text-[#9ab0a6] text-[11px]">(min 8 characters)</span></label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full rounded-2xl border border-[#d8e2df] bg-white px-4 py-3.5 text-sm font-semibold text-[#172226] focus:border-[#287555] focus:outline-none focus:ring-2 focus:ring-[#287555]/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[.1em] text-[#71807a] mb-1.5">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full rounded-2xl border border-[#d8e2df] bg-white px-4 py-3.5 text-sm font-semibold text-[#172226] focus:border-[#287555] focus:outline-none focus:ring-2 focus:ring-[#287555]/20"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || resetOtpCode.length !== 6 || !newPassword || newPassword !== confirmNewPassword}
                    className="w-full rounded-2xl bg-[#287555] py-4 text-sm font-bold text-white hover:bg-[#1f5c43] disabled:opacity-50 transition shadow-md"
                  >
                    {loading ? "Updating Password..." : "Update Password & Sign In →"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep(false)
                      setResetStep(false)
                      setError("")
                    }}
                    className="w-full text-center text-xs font-bold text-[#71807a] hover:underline"
                  >
                    ← Back to Sign In
                  </button>
                </form>
              )}
            </div>
          ) : otpStep ? (
            <div className="mt-8 space-y-5">
              <div>
                <span className="rounded-full bg-[#f3faee] border border-[#cbe2d4] px-3 py-1 text-xs font-bold text-[#287555]">
                  ✉️ Email OTP Verification
                </span>
                <h1 className="mt-3 text-3xl font-bold tracking-[-.05em]">Verify Your Email</h1>
                <p className="mt-2 text-xs leading-5 text-[#71807a]">
                  We have sent a 6-digit verification OTP code to <strong className="text-[#172226]">{email}</strong>. Please enter the code below to complete account setup.
                </p>
              </div>

              {error && <div className="rounded-xl bg-[#feebee] p-3 text-xs font-bold text-[#c62828] border border-[#ffcdd2]">{error}</div>}

              <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-[.1em] text-[#71807a] mb-1.5">Registered Email</label>
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="w-full rounded-2xl border border-[#d8e2df] bg-white px-4 py-3.5 text-sm font-semibold text-[#172226] opacity-60 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#172226]">6-Digit Email OTP Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="Enter 6-digit OTP"
                    className="mt-1.5 w-full text-center tracking-[.3em] font-mono text-2xl font-bold rounded-2xl border border-[#d5deda] bg-white py-3.5 text-[#287555] focus:outline-none focus:ring-2 focus:ring-[#287555]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full rounded-2xl bg-[#287555] py-4 text-sm font-bold text-white hover:bg-[#1f5c43] disabled:opacity-50 transition shadow-md"
                >
                  {loading ? "Verifying OTP Code..." : "Verify OTP & Complete Account Setup →"}
                </button>

                <div className="flex justify-between items-center pt-2 text-xs">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading || resendCooldown > 0}
                    className="font-bold text-[#287555] hover:underline disabled:opacity-50"
                  >
                    {resendCooldown > 0 ? `🔄 Resend OTP Code (${resendCooldown}s)` : "🔄 Resend OTP Code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep(false)
                      setError("")
                    }}
                    className="font-semibold text-[#71807a] hover:underline"
                  >
                    ← Change Email
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              <div className="mt-8">
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#edf3ef] p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup")
                      setError("")
                    }}
                    className={`rounded-xl py-2.5 text-xs font-bold transition ${mode === "signup" ? "bg-white shadow text-[#287555]" : "text-[#71807a]"}`}
                  >
                    Create Account (একাউন্ট)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login")
                      setError("")
                    }}
                    className={`rounded-xl py-2.5 text-xs font-bold transition ${mode === "login" ? "bg-white shadow text-[#287555]" : "text-[#71807a]"}`}
                  >
                    Sign In (লগইন)
                  </button>
                </div>

                <div className="mt-8">
                  <h1 className="text-3xl font-bold tracking-[-.05em]">{mode === "signup" ? "Create Parent Account" : "Welcome Back"}</h1>
                  <p className="mt-2 text-xs leading-5 text-[#71807a]">
                    {mode === "signup"
                      ? "Register your primary parent account to manage routines, safety & remote help."
                      : "Sign in to access your child's real-time safety dashboard & controls."}
                  </p>
                </div>

                {error && <div className="mt-4 rounded-xl bg-[#feebee] p-3 text-xs font-bold text-[#c62828] border border-[#ffcdd2]">{error}</div>}

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  {mode === "signup" && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[.1em] text-[#71807a] mb-1.5">Parent Full Name</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ava Morgan"
                        className="w-full rounded-2xl border border-[#d8e2df] bg-white px-4 py-3.5 text-sm font-semibold text-[#172226] focus:border-[#287555] focus:outline-none focus:ring-2 focus:ring-[#287555]/20"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[.1em] text-[#71807a] mb-1.5">Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ava.morgan@staykids.family"
                      className="w-full rounded-2xl border border-[#d8e2df] bg-white px-4 py-3.5 text-sm font-semibold text-[#172226] focus:border-[#287555] focus:outline-none focus:ring-2 focus:ring-[#287555]/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[.1em] text-[#71807a] mb-1.5">Password {mode === "signup" && <span className="normal-case font-normal text-[#9ab0a6] text-[11px]">(min 8 characters)</span>}</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-2xl border border-[#d8e2df] bg-white px-4 py-3.5 text-sm font-semibold text-[#172226] focus:border-[#287555] focus:outline-none focus:ring-2 focus:ring-[#287555]/20 pr-10"
                      />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-[#71807a] hover:text-[#287555]"
                        >
                          {showPassword ? "🙈" : "👁"}
                        </button>
                    </div>
                  </div>

                  {mode === "signup" && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[.1em] text-[#71807a] mb-1.5">Confirm Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full rounded-2xl border border-[#d8e2df] bg-white px-4 py-3.5 text-sm font-semibold text-[#172226] focus:border-[#287555] focus:outline-none focus:ring-2 focus:ring-[#287555]/20 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-[#71807a] hover:text-[#287555]"
                        >
                          {showPassword ? "🙈" : "👁"}
                        </button>
                      </div>
                    </div>
                  )}

                  {mode === "login" && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setForgotStep(true)
                          setError("")
                        }}
                        className="text-xs font-bold text-[#287555] hover:underline"
                      >
                        🔑 Forgot Password? (পাসওয়ার্ড ভুলে গেছেন?)
                      </button>
                    </div>
                  )}

                  <button type="submit" className="w-full rounded-2xl bg-[#287555] py-4 text-sm font-bold text-white hover:bg-[#1f5c43] shadow-md transition">
                    {mode === "signup" ? "Create Account & Continue →" : "Sign In to StayKids →"}
                  </button>
                </form>

                <p className="mt-4 text-center text-[11px] text-[#869690]">
                  By continuing, you agree to StayKids{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setLegalTab("terms")
                      setShowLegal(true)
                    }}
                    className="font-bold text-[#287555] hover:underline"
                  >
                    Terms
                  </button>{" "}
                  and{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setLegalTab("privacy")
                      setShowLegal(true)
                    }}
                    className="font-bold text-[#287555] hover:underline"
                  >
                    Privacy Policy
                  </button>
                  .
                </p>

                <p className="mt-4 text-center text-xs text-[#71807a]">
                  {mode === "signup" ? (
                    <>
                      Already registered?{" "}
                      <button onClick={() => setMode("login")} className="font-bold text-[#287555] hover:underline">
                        Sign In
                      </button>
                    </>
                  ) : (
                    <>
                      New to StayKids?{" "}
                      <button onClick={() => setMode("signup")} className="font-bold text-[#287555] hover:underline">
                        Create Parent Account
                      </button>
                    </>
                  )}
                </p>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
