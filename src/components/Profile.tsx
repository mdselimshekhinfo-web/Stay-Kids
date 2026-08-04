import { useState, useEffect } from "react"
import type { StayKidsState } from "../lib/staykids-api"
import { changeParentPassword, exportUserData, deleteUserAccount } from "../lib/staykids-api"
import { LegalModal } from "./LegalModal"
import { SubscriptionModal } from "./SubscriptionModal"
import { PREMIUM_ENABLED } from "../lib/config"

export function Profile({
  state,
  user,
  onSignOut,
  onAction,
}: {
  state: StayKidsState
  switchRole?: (role: "parent" | "child") => void
  user: { name: string; email: string }
  onSignOut: () => void
  onAction?: (action: Record<string, unknown>) => void
}) {
  const [lang, setLangState] = useState<"en" | "bn">(() => {
    try {
      const saved = localStorage.getItem("app_lang")
      return (saved === "bn" || saved === "en") ? saved : "en"
    } catch (_e) {
      return "en"
    }
  })
  const setLang = (newLang: "en" | "bn") => {
    setLangState(newLang)
    try {
      localStorage.setItem("app_lang", newLang)
    } catch (_e) {}
  }
  const [showLegal, setShowLegal] = useState(false)
  const [legalTab, setLegalTab] = useState<"terms" | "privacy">("terms")
  const [showSubModal, setShowSubModal] = useState(false)

  // B.1 Protection Status Checklist State
  const [protectionStatus, setProtectionStatus] = useState({
    accessibility: false,
    admin: false,
    battery: false,
    overlay: false,
    camera: false,
    location: false,
    mic: false,
  })
  const [statusChecking, setStatusChecking] = useState(false)

  // B.2 Change Password State
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pwdMsg, setPwdMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [pwdLoading, setPwdLoading] = useState(false)

  // B.4 Account Deletion Modal State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState("")

  // B.5 App Lock State
  const [biometricEnabled, setBiometricEnabled] = useState(() => {
    return localStorage.getItem("staykids_biometric_enabled") === "true"
  })
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  // B.5 Notification Preferences State
  const defaultPrefs = { sos: true, block: true, location: true, call: true, activity: true }
  const [notifPrefs, setNotifPrefs] = useState(() => (state as any).notificationPrefs || defaultPrefs)

  const refreshProtectionStatus = async () => {
    setStatusChecking(true)
    try {
      const {
        checkAccessibilityEnabled,
        checkDeviceAdminEnabled,
        checkBatteryOptimizationDisabled,
        checkOverlayPermissionGranted,
        checkCameraPermission,
        checkLocationPermission,
        checkMicrophonePermission,
      } = await import("../lib/native")

      const [acc, adm, bat, ovl, cam, loc, mic] = await Promise.all([
        checkAccessibilityEnabled().catch(() => false),
        checkDeviceAdminEnabled().catch(() => false),
        checkBatteryOptimizationDisabled().catch(() => false),
        checkOverlayPermissionGranted().catch(() => false),
        checkCameraPermission().catch(() => false),
        checkLocationPermission().catch(() => false),
        checkMicrophonePermission().catch(() => false),
      ])

      setProtectionStatus({
        accessibility: acc,
        admin: adm,
        battery: bat,
        overlay: ovl,
        camera: typeof cam === "boolean" ? cam : !!(cam as any)?.granted,
        location: typeof loc === "boolean" ? loc : !!(loc as any)?.granted,
        mic: typeof mic === "boolean" ? mic : !!(mic as any)?.granted,
      })
    } catch (_e) {
      // Fallback in web mode
    } finally {
      setStatusChecking(false)
    }
  }

  useEffect(() => {
    refreshProtectionStatus().catch(() => {})
  }, [])

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdMsg(null)

    if (!currentPassword || !newPassword) {
      setPwdMsg({ type: "error", text: "Please enter current and new passwords." })
      return
    }
    if (newPassword.length < 8) {
      setPwdMsg({ type: "error", text: "New password must be at least 8 characters long." })
      return
    }
    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: "error", text: "New passwords do not match." })
      return
    }

    setPwdLoading(true)
    try {
      const res = await changeParentPassword({ currentPassword, newPassword })
      if (res.success) {
        setPwdMsg({ type: "success", text: res.message || "Password updated successfully!" })
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
        setTimeout(() => setShowChangePassword(false), 2000)
      } else {
        setPwdMsg({ type: "error", text: res.error || "Failed to update password." })
      }
    } catch (e: any) {
      setPwdMsg({ type: "error", text: e?.message || "Error updating password." })
    } finally {
      setPwdLoading(false)
    }
  }

  const handleExportData = async () => {
    setExportLoading(true)
    try {
      const data = await exportUserData()
      const jsonStr = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonStr], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `staykids_account_data_${new Date().toISOString().split("T")[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert("Failed to export data: " + (e?.message || "Unknown error"))
    } finally {
      setExportLoading(false)
    }
  }

  const handleDeleteAccountSubmit = async () => {
    if (deleteInput.trim().toUpperCase() !== "DELETE") {
      alert('Please type "DELETE" to confirm account deletion.')
      return
    }
    setDeleteLoading(true)
    try {
      const res = await deleteUserAccount()
      if (res.success) {
        alert("Account deleted. You will now be signed out.")
        onSignOut()
      } else {
        alert("Account deletion failed: " + (res.error || "Unknown error"))
      }
    } catch (e: any) {
      alert("Error deleting account: " + (e?.message || "Unknown error"))
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleNotifToggle = (key: keyof typeof defaultPrefs) => {
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] }
    setNotifPrefs(updated)
    if (onAction) {
      onAction({ type: "update-notification-prefs", prefs: updated })
    }
  }

  const pairedChildren = state.children && state.children.length > 0 ? state.children : [state.child]

  const initials = (user?.name || "")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0] || "")
    .join("")
    .substring(0, 2)
    .toUpperCase()

  return (
    <div className="space-y-5 pb-24 font-sans text-[#172226]">
      <LegalModal isOpen={showLegal} onClose={() => setShowLegal(false)} initialTab={legalTab} />
      {PREMIUM_ENABLED && <SubscriptionModal isOpen={showSubModal} onClose={() => setShowSubModal(false)} />}

      <div className="pt-2">
        <p className="text-sm text-[#70808b]">Account & Preferences</p>
        <h1 className="mt-1 text-[28px] font-bold tracking-[-.05em]">Profile</h1>
      </div>

      {/* Parent Profile Card */}
      <div className="rounded-[28px] bg-[#1d5946] p-6 text-white shadow-md">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-[#ffe7c2] text-2xl font-bold text-[#8c5b00] border-2 border-white/20">
            {initials || "P"}
          </div>
          <div>
            <h2 className="text-xl font-bold">{user.name}</h2>
            <p className="text-sm text-[#cce0d5]">{user.email}</p>
            <span className="mt-2 inline-block rounded-full bg-[#baf26b] px-3 py-0.5 text-xs font-bold text-[#17352b]">
              Primary Parent (Account Owner)
            </span>
          </div>
        </div>
      </div>

      {/* Child Profile Info Card */}
      <div className="rounded-[24px] border border-[#e1e7e8] bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b pb-3 border-[#f0f4f4]">
          <p className="font-bold text-base text-[#172226]">Child Profile</p>
          <span className="text-xs font-bold text-[#287555]">Paired Device ✓</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-[#f8fbf9] p-3 rounded-xl">
            <p className="text-xs text-[#71807a]">Child Name</p>
            <p className="font-bold text-[#172226] mt-0.5">{state.child.name}</p>
          </div>
          <div className="bg-[#f8fbf9] p-3 rounded-xl">
            <p className="text-xs text-[#71807a]">Age / Grade</p>
            <p className="font-bold text-[#172226] mt-0.5">—</p>
          </div>
          <div className="bg-[#f8fbf9] p-3 rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#71807a]">School</p>
              {onAction && (
                <button
                  type="button"
                  onClick={() => {
                    const val = prompt("Enter Child's School Name:", state.child.school || "")
                    if (val !== null) {
                      onAction({ type: "update-school", school: val.trim() })
                    }
                  }}
                  className="text-[10px] font-bold text-[#287555] hover:underline"
                >
                  ✏️ Edit
                </button>
              )}
            </div>
            <p className="font-bold text-[#172226] mt-0.5 truncate">{state.child.school || "Not set"}</p>
          </div>
          <div className="bg-[#f8fbf9] p-3 rounded-xl">
            <p className="text-xs text-[#71807a]">Device Model</p>
            <p className="font-bold text-[#172226] mt-0.5">{state.child.device}</p>
          </div>
        </div>
      </div>

      {/* B.1 Real-Time Protection-Status Checklist */}
      <div className="rounded-[24px] border border-[#e1e7e8] bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b pb-3 border-[#f0f4f4]">
          <div>
            <p className="font-bold text-base text-[#172226]">🛡️ Protection Status Checklist</p>
            <p className="text-xs text-[#71807a]">Native permissions on paired child device</p>
          </div>
          <button
            onClick={() => refreshProtectionStatus()}
            disabled={statusChecking}
            className="text-xs font-bold text-[#287555] hover:underline disabled:opacity-50"
          >
            {statusChecking ? "Checking..." : "🔄 Refresh"}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {[
            { label: "Accessibility Service", status: protectionStatus.accessibility, icon: "⚙️" },
            { label: "Device Admin Protection", status: protectionStatus.admin, icon: "🔒" },
            { label: "Battery Saver Exempted", status: protectionStatus.battery, icon: "⚡" },
            { label: "Display Over Apps (Overlay)", status: protectionStatus.overlay, icon: "🪟" },
            { label: "Camera Access", status: protectionStatus.camera, icon: "📷" },
            { label: "GPS Location Access", status: protectionStatus.location, icon: "📍" },
            { label: "Microphone Access", status: protectionStatus.mic, icon: "🎤" },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-[#f8fbf9] border border-[#e8f0eb]">
              <span className="flex items-center gap-1.5 font-medium text-[#2d3a35]">
                <span>{item.icon}</span> {item.label}
              </span>
              <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${item.status ? "bg-[#d7f5e3] text-[#1b6b3e]" : "bg-[#fde8e8] text-[#c62828]"}`}>
                {item.status ? "Active ✓" : "Off ⚠️"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* B.3 Paired Child Device Management */}
      <div className="rounded-[24px] border border-[#e1e7e8] bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b pb-3 border-[#f0f4f4]">
          <p className="font-bold text-base text-[#172226]">📱 Paired Devices Management</p>
          <span className="text-xs text-[#71807a]">{pairedChildren.length} Device(s)</span>
        </div>

        <div className="space-y-2">
          {pairedChildren.map((ch) => (
            <div key={ch.id} className="flex items-center justify-between p-3 rounded-2xl bg-[#f8fbf9] border border-[#e8f0eb]">
              <div>
                <p className="font-bold text-sm text-[#172226]">{ch.name}'s {ch.device}</p>
                <p className="text-xs text-[#71807a]">
                  Status: <span className={ch.online ? "text-[#287555] font-bold" : "text-[#809098]"}>{ch.online ? "● Online" : "○ Offline"}</span>
                </p>
              </div>
              {onAction && pairedChildren.length > 1 && (
                <button
                  onClick={() => {
                    if (confirm(`Unpair and revoke token for ${ch.name}'s device? This device will lose access.`)) {
                      onAction({ type: "unpair-device", childId: ch.id })
                    }
                  }}
                  className="rounded-xl border border-[#ffcdd2] bg-[#feebee] px-3 py-1.5 text-xs font-bold text-[#c62828] hover:bg-[#ffcdd2] transition"
                >
                  Unpair ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* B.5 App Lock Settings */}
      <div className="rounded-[24px] border border-[#e1e7e8] bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-base text-[#172226]">🔒 Biometric App Lock</p>
            <p className="text-xs text-[#71807a]">Require fingerprint/face to open app</p>
          </div>
          <button
            onClick={() => {
              const nextState = !biometricEnabled;
              if (nextState) {
                import('../lib/native').then(({ authenticateBiometricNative }) => {
                  authenticateBiometricNative().then(success => {
                    if (success) {
                      localStorage.setItem("staykids_biometric_enabled", "true")
                      setBiometricEnabled(true)
                    } else {
                      alert("Biometric setup failed or cancelled.")
                    }
                  })
                })
              } else {
                localStorage.setItem("staykids_biometric_enabled", "false")
                setBiometricEnabled(false)
              }
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${biometricEnabled ? "bg-[#287555]" : "bg-[#cbe0d3]"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${biometricEnabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
      </div>

      {/* B.2 In-App Password Change */}
      <div className="rounded-[24px] border border-[#e1e7e8] bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b pb-3 border-[#f0f4f4]">
          <div>
            <p className="font-bold text-base text-[#172226]">🔑 Account Password</p>
            <p className="text-xs text-[#71807a]">Update parent account security credential</p>
          </div>
          <button
            onClick={() => {
              setShowChangePassword(!showChangePassword)
              setPwdMsg(null)
            }}
            className="text-xs font-bold text-[#287555] hover:underline"
          >
            {showChangePassword ? "Cancel" : "Change Password"}
          </button>
        </div>

        {showChangePassword && (
          <form onSubmit={handleChangePasswordSubmit} className="space-y-3 pt-1">
            {pwdMsg && (
              <div className={`p-3 rounded-xl text-xs font-bold ${pwdMsg.type === "success" ? "bg-[#d7f5e3] text-[#1b6b3e]" : "bg-[#fde8e8] text-[#c62828]"}`}>
                {pwdMsg.text}
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-[#586770]">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#cbe0d3] p-2.5 text-xs focus:ring-2 focus:ring-[#287555] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#586770]">New Password (min 8 characters)</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#cbe0d3] p-2.5 text-xs focus:ring-2 focus:ring-[#287555] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#586770]">Confirm New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#cbe0d3] p-2.5 text-xs focus:ring-2 focus:ring-[#287555] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={pwdLoading}
              className="w-full rounded-xl bg-[#287555] py-2.5 text-xs font-bold text-white hover:bg-[#1f5c43] transition shadow disabled:opacity-50"
            >
              {pwdLoading ? "Updating..." : "Update Password →"}
            </button>
          </form>
        )}

        <div className="pt-2 border-t border-[#f0f4f4] flex items-center justify-between">
          <div>
            <p className="font-bold text-xs text-[#172226]">Multi-Device Session Control</p>
            <p className="text-[11px] text-[#71807a]">Invalidate all active logins across all devices</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (confirm("Revoke all active parent sessions across all devices? You will be required to log in again.")) {
                const { revokeAllParentSessions } = await import("../lib/staykids-api")
                const res = await revokeAllParentSessions()
                if (res.success) {
                  alert("All active sessions revoked. Signing out.")
                  onSignOut()
                }
              }
            }}
            className="rounded-xl border border-[#cbe0d3] bg-[#f8fbf9] px-3 py-1.5 text-xs font-bold text-[#287555] hover:bg-[#ebf7e4] transition"
          >
            Revoke All Sessions 🔒
          </button>
        </div>
      </div>

      {/* B.5 Notification Category Preferences */}
      <div className="rounded-[24px] border border-[#e1e7e8] bg-white p-5 shadow-sm space-y-3">
        <p className="font-bold text-base text-[#172226]">🔔 Alert Notification Preferences</p>
        <p className="text-xs text-[#71807a]">Choose which alert categories send push notifications</p>

        <div className="space-y-2 pt-1 text-xs">
          {[
            { key: "sos", label: "🚨 Emergency & SOS Signals", desc: "High-priority siren & SOS button triggers" },
            { label: "🚫 App Restrictions & Security", key: "block", desc: "Accessibility/Device-admin disabled alerts" },
            { label: "⌖ GPS Safe Zone Boundaries", key: "location", desc: "Geofence arrival & departure alerts" },
            { label: "📞 Calls & Activity Logs", key: "call", desc: "Call/SMS activity notifications" },
            { label: "📷 Snapshots & Screen Mirroring", key: "activity", desc: "Camera capture & live stream sessions" },
          ].map((item) => {
            const isChecked = !!(notifPrefs as any)[item.key]
            return (
              <div key={item.key} className="flex items-center justify-between p-2.5 rounded-xl bg-[#f8fbf9]">
                <div>
                  <p className="font-bold text-[#172226]">{item.label}</p>
                  <p className="text-[11px] text-[#71807a]">{item.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleNotifToggle(item.key as any)}
                  className={`w-10 h-6 flex items-center rounded-full p-1 transition ${isChecked ? "bg-[#287555] justify-end" : "bg-[#ccc] justify-start"}`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-md"></span>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* B.6 Multi-Guardian Access Placeholder */}
      <div className="rounded-[24px] border border-[#e1e7e8] bg-white p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-bold text-base text-[#172226]">👥 Family Guardians & Co-Parents</p>
          <span className="text-[10px] font-bold text-[#287555] bg-[#edf3ef] px-2 py-0.5 rounded-full">(Coming Soon)</span>
        </div>
        <p className="text-xs text-[#71807a]">
          Invite a secondary parent, grandparent, or trusted guardian to co-monitor child devices with customized permission levels.
        </p>
      </div>

      {/* Subscription (Rendered only when PREMIUM_ENABLED is true) */}
      {PREMIUM_ENABLED && (
        <div className="rounded-[24px] border border-[#e1e7e8] bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-base text-[#172226]">Subscription Plan</p>
            <button onClick={() => setShowSubModal(true)} className="text-xs font-bold text-[#287555] hover:underline">
              Manage Billing →
            </button>
          </div>
          <div onClick={() => setShowSubModal(true)} className="cursor-pointer flex items-center justify-between rounded-2xl bg-[#f3faee] p-3.5 border border-[#d5e8ce] hover:bg-[#ebf7e4] transition">
            <div>
              <p className="font-bold text-sm text-[#1e4d3b]">7-Day Free Trial (All Features Unlocked)</p>
              <p className="text-xs text-[#597869]">7 Days Remaining · No Payment Required</p>
            </div>
            <span className="rounded-full bg-[#287555] px-3 py-1 text-xs font-bold text-white">Free Trial 🎉</span>
          </div>
        </div>
      )}

      {/* Preferences, Language & Legal */}
      <div className="rounded-[24px] border border-[#e1e7e8] bg-white p-5 shadow-sm space-y-4">
        <p className="font-bold text-base text-[#172226]">App Preferences & Legal</p>
        <div className="flex items-center justify-between border-b pb-3 border-[#f0f4f4]">
          <div>
            <p className="font-bold text-sm">
              App Language (ভাষা) <span className="text-[10px] font-bold text-[#287555] bg-[#edf3ef] px-1.5 py-0.5 rounded-full ml-1">Active ✓</span>
            </p>
            <p className="text-xs text-[#71807a]">Choose interface language</p>
          </div>
          <div className="flex rounded-xl bg-[#edf3ef] p-1">
            <button
              onClick={() => setLang("en")}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition ${lang === "en" ? "bg-white shadow text-[#287555]" : "text-[#71807a]"}`}
            >
              English
            </button>
            <button
              onClick={() => setLang("bn")}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition ${lang === "bn" ? "bg-white shadow text-[#287555]" : "text-[#71807a]"}`}
            >
              বাংলা
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center pt-1">
          <div>
            <p className="font-bold text-sm">Terms & Privacy Policy</p>
            <p className="text-xs text-[#71807a]">View app terms, COPPA & privacy guidelines</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setLegalTab("terms")
                setShowLegal(true)
              }}
              className="text-xs font-bold text-[#287555] hover:underline"
            >
              Terms
            </button>
            <span className="text-xs text-[#b8c4be]">•</span>
            <button
              onClick={() => {
                setLegalTab("privacy")
                setShowLegal(true)
              }}
              className="text-xs font-bold text-[#287555] hover:underline"
            >
              Privacy
            </button>
          </div>
        </div>
      </div>

      {/* B.4 Export Data & Danger Zone (Account Deletion) */}
      <div className="rounded-[24px] border border-[#e1e7e8] bg-white p-5 shadow-sm space-y-3">
        <p className="font-bold text-base text-[#172226]">📥 Data Privacy & Danger Zone</p>
        
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="font-bold text-xs text-[#172226]">Export Account Data</p>
            <p className="text-[11px] text-[#71807a]">Download JSON copy of profile & alert history</p>
          </div>
          <button
            onClick={handleExportData}
            disabled={exportLoading}
            className="rounded-xl border border-[#cbe0d3] bg-[#f3faee] px-3 py-1.5 text-xs font-bold text-[#287555] hover:bg-[#ebf7e4] transition disabled:opacity-50"
          >
            {exportLoading ? "Exporting..." : "Export Data 📥"}
          </button>
        </div>

        <div className="border-t border-[#f0f4f4] pt-3 flex items-center justify-between">
          <div>
            <p className="font-bold text-xs text-[#c62828]">Delete Account Permanently</p>
            <p className="text-[11px] text-[#71807a]">Purge all children devices, controls & alerts</p>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-xl border border-[#ffcdd2] bg-[#feebee] px-3 py-1.5 text-xs font-bold text-[#c62828] hover:bg-[#ffcdd2] transition"
          >
            Delete Account 🗑️
          </button>
        </div>
      </div>

      {/* Account Deletion Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl space-y-4 text-[#172226]">
            <div className="flex items-center justify-between border-b pb-3 border-[#feebee]">
              <h2 className="text-base font-bold text-[#c62828]">⚠️ Confirm Account Deletion</h2>
              <button onClick={() => setShowDeleteConfirm(false)} className="rounded-full bg-[#edf2ef] p-1.5 text-xs font-bold text-[#5c6e67]">
                ✕
              </button>
            </div>
            <p className="text-xs text-[#5c6e67] leading-relaxed">
              This action is <strong className="text-[#c62828]">permanent and irreversible</strong>. All paired child devices, screen time limits, and security logs will be completely deleted.
            </p>
            <div>
              <label className="text-xs font-bold text-[#172226]">Type "DELETE" to confirm:</label>
              <input
                type="text"
                placeholder="DELETE"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#ffcdd2] p-2.5 text-xs focus:ring-2 focus:ring-[#c62828] focus:outline-none"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-xl border border-[#cbe0d3] py-2.5 text-xs font-bold text-[#586770]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccountSubmit}
                disabled={deleteLoading || deleteInput.trim().toUpperCase() !== "DELETE"}
                className="flex-1 rounded-xl bg-[#c62828] py-2.5 text-xs font-bold text-white hover:bg-[#b71c1c] transition disabled:opacity-50"
              >
                {deleteLoading ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={onSignOut}
        className="w-full rounded-2xl border border-[#ffcdd2] bg-[#feebee] py-3.5 text-sm font-bold text-[#c62828] hover:bg-[#ffcdd2] transition shadow-sm"
      >
        Sign Out (লগআউট)
      </button>
    </div>
  )
}
