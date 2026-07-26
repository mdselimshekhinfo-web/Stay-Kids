import React, { useEffect, useState } from "react"
import { generatePairingCode, claimDevicePairing } from "../lib/staykids-api"
import {
  checkAccessibilityEnabled,
  openAccessibilitySettings,
  checkDeviceAdminEnabled,
  requestEnableDeviceAdmin,
  checkBatteryOptimizationDisabled,
  requestDisableBatteryOptimization,
  checkOverlayPermissionGranted,
  requestOverlayPermission,
  checkCameraPermission,
  requestCameraPermission,
  checkLocationPermission,
  requestLocationPermission,
  checkMicrophonePermission,
  requestMicrophonePermission,
  startNativeScreenShare,
} from "../lib/native"
import { PermissionInstructionModal } from "./PermissionInstructionModal"

export function Onboarding({
  complete,
  defaultRole = "parent",
  activeChildId = "child-1",
}: {
  complete: (role: "parent" | "child") => void
  defaultRole?: "parent" | "child"
  activeChildId?: string
}) {
  const [step, setStep] = useState(0)
  const [role, setRole] = useState<"parent" | "child">(defaultRole)
  const [pairMode, setPairMode] = useState<"pin" | "qr">("pin")
  const [dynamicPin, setDynamicPin] = useState("849201")
  const [inputPin, setInputPin] = useState("")
  const [qrScanned, setQrScanned] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [accEnabled, setAccEnabled] = useState(false)
  const [batteryOptDisabled, setBatteryOptDisabled] = useState(false)
  const [adminEnabled, setAdminEnabled] = useState(false)
  const [overlayGranted, setOverlayGranted] = useState(false)
  const [cameraGranted, setCameraGranted] = useState(false)
  const [locationGranted, setLocationGranted] = useState(false)
  const [micGranted, setMicGranted] = useState(false)
  const [screenCaptureGranted, setScreenCaptureGranted] = useState(false)

  // Guided Permission Instruction Modal State
  const [guideModal, setGuideModal] = useState<{
    isOpen: boolean
    title: string
    steps: string[]
    onOpenSettings: () => Promise<void>
  }>({
    isOpen: false,
    title: "",
    steps: [],
    onOpenSettings: async () => {},
  })

  const refreshPermissionsState = async () => {
    const acc = await checkAccessibilityEnabled()
    const bat = await checkBatteryOptimizationDisabled()
    const adm = await checkDeviceAdminEnabled()
    const ovl = await checkOverlayPermissionGranted()
    const cam = await checkCameraPermission()
    const loc = await checkLocationPermission()
    const mic = await checkMicrophonePermission()
    setAccEnabled(acc)
    setBatteryOptDisabled(bat)
    setAdminEnabled(adm)
    setOverlayGranted(ovl)
    setCameraGranted(cam)
    setLocationGranted(loc)
    setMicGranted(mic)
  }

  useEffect(() => {
    refreshPermissionsState()
  }, [step])

  const generateNewPin = async () => {
    try {
      const res = await generatePairingCode(activeChildId)
      if (res.pin) setDynamicPin(res.pin)
    } catch (_e) {
      setDynamicPin(String(Math.floor(100000 + Math.random() * 900000)))
    }
  }

  useEffect(() => {
    if (role === "parent" && step === 1) {
      generateNewPin()
    }
  }, [role, step])

  const handleNextStep = async () => {
    if (step === 1 && role === "child") {
      if (!inputPin || inputPin.length !== 6) {
        setError("Please enter a valid 6-digit PIN code.")
        return
      }
      setLoading(true)
      setError("")
      try {
        const res = await claimDevicePairing({ pin: inputPin, deviceName: "Child Android Device" })
        if (res.error) throw new Error(res.error)
        setStep(step + 1)
      } catch (err: any) {
        setError(err.message || "Failed to claim pairing PIN.")
      } finally {
        setLoading(false)
      }
    } else if (step === 2) {
      if (role === "child" && !accEnabled) {
        setError("StayKids Accessibility Service must be enabled in Android System Settings before completing child device setup.")
        return
      }
      complete(role)
    } else {
      setError("")
      setStep(step + 1)
    }
  }

  const pages = [
    {
      tag: "StayKids Security",
      icon: "✦",
      title: role === "parent" ? "A calmer digital childhood starts here." : "Connect to parent device securely.",
      text: role === "parent" ? "One parent app for routines, safety updates, and instant remote support." : "Scan QR Code or enter the dynamic single-use 6-digit pairing code.",
    },
    {
      tag: "Step 1 of 2",
      icon: "⌁",
      title: role === "parent" ? "Device Pairing (কোড বা QR)" : "Pair Device (PIN বা QR)",
      text: role === "parent" ? "Use this 6-digit PIN or QR Code on Mia’s device to pair instantly." : "Enter 6-digit code or scan parent QR code with camera.",
    },
    {
      tag: "Step 2 of 2",
      icon: "✓",
      title: "Grant One-Time Consent",
      text: "One-time permission for remote assistance (Screen Mirror, Audio, Snapshot) is granted during this setup so you don't need to ask repeatedly.",
    },
  ]
  const page = pages[step]

  return (
    <main className="grid min-h-screen place-items-center bg-[#dfe8df] p-4 font-sans text-[#172226]">
      <section className="relative w-full max-w-[480px] overflow-hidden rounded-[36px] bg-[#f8fbfb] p-7 shadow-2xl sm:p-9">
        <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-[#d6f4ad]" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="font-bold tracking-[-.04em]">
              stay<span className="text-[#287555]">kids</span>
            </p>
            <div className="flex gap-1">
              {pages.map((_, i) => (
                <span key={i} className={`h-1.5 w-6 rounded-full ${i <= step ? "bg-[#287555]" : "bg-[#dbe4e2]"}`} />
              ))}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-2 rounded-2xl bg-[#edf3ef] p-1">
            <button onClick={() => setRole("parent")} className={`rounded-xl py-2 text-xs font-bold ${role === "parent" ? "bg-white shadow text-[#287555]" : "text-[#71807a]"}`}>
              I’m a parent
            </button>
            <button onClick={() => setRole("child")} className={`rounded-xl py-2 text-xs font-bold ${role === "child" ? "bg-white shadow text-[#287555]" : "text-[#71807a]"}`}>
              This is a child device
            </button>
          </div>

          <div className="mt-8 grid h-16 w-16 place-items-center rounded-[24px] bg-[#1d5946] text-3xl text-[#d6f4ad]">{page.icon}</div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[.15em] text-[#287555]">{page.tag}</p>
          <h1 className="mt-2 text-3xl font-bold leading-[1.1] tracking-[-.05em]">{page.title}</h1>
          <p className="mt-2 max-w-sm text-xs leading-5 text-[#6e7c83]">{page.text}</p>

          {step === 0 && (
            <div className="mt-4 rounded-2xl bg-[#edf3ef] p-4 text-xs space-y-3 border border-[#c3d7cb]">
              <div className="flex items-center gap-2 text-[#1d5946] font-bold">
                <span>📜</span>
                <span>Google Play Policy Prominent Disclosure</span>
              </div>
              <p className="text-[11px] leading-relaxed text-[#4b5953]">
                StayKids collects <strong>Location, Camera, Microphone, Screen Stream,</strong> and <strong>Accessibility Usage</strong> strictly for authorized parental oversight & child protection. All data transmission is encrypted via HTTPS/TLS and never shared with third parties.
              </p>
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-semibold text-[#1d5946]">
                <div className="rounded-lg bg-white p-2 border border-[#d5e3da]">📍 Real-time GPS Location</div>
                <div className="rounded-lg bg-white p-2 border border-[#d5e3da]">📷 Remote Camera Snapshots</div>
                <div className="rounded-lg bg-white p-2 border border-[#d5e3da]">🎙️ Ambient Surroundings Audio</div>
                <div className="rounded-lg bg-white p-2 border border-[#d5e3da]">📱 Live HD Screen Oversight</div>
              </div>
            </div>
          )}

          {error && <div className="mt-4 rounded-xl bg-[#feebee] p-3 text-xs font-bold text-[#c62828] border border-[#ffcdd2]">{error}</div>}

          {step === 1 && (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#edf3ef] p-1">
                <button
                  type="button"
                  onClick={() => setPairMode("pin")}
                  className={`rounded-lg py-1.5 text-xs font-bold transition ${pairMode === "pin" ? "bg-white shadow text-[#287555]" : "text-[#71807a]"}`}
                >
                  🔢 6-Digit PIN
                </button>
                <button
                  type="button"
                  onClick={() => setPairMode("qr")}
                  className={`rounded-lg py-1.5 text-xs font-bold transition ${pairMode === "qr" ? "bg-white shadow text-[#287555]" : "text-[#71807a]"}`}
                >
                  📷 QR Code (কিউআর)
                </button>
              </div>

              {role === "parent" && pairMode === "pin" && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center rounded-2xl border border-dashed border-[#a9c9b2] bg-[#f3faee] px-6 py-4 font-mono text-2xl font-bold tracking-[.3em] text-[#287555]">
                    <span>{dynamicPin.slice(0, 3)}</span>
                    <span>{dynamicPin.slice(3, 6)}</span>
                  </div>
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[11px] font-semibold text-[#687b74]">🔒 Single-Use PIN</span>
                    <button onClick={generateNewPin} className="text-[11px] font-bold text-[#287555] hover:underline">
                      🔄 Refresh Code
                    </button>
                  </div>
                </div>
              )}

              {role === "parent" && pairMode === "qr" && (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-[#a9c9b2] bg-[#f3faee] p-5 text-center">
                  <div className="relative grid h-36 w-36 place-items-center rounded-2xl bg-white p-3 shadow-inner border border-[#d2e5d8]">
                    <div className="grid grid-cols-5 gap-1.5 w-full h-full p-1 opacity-80">
                      {Array.from({ length: 25 }).map((_, i) => (
                        <div key={i} className={`rounded-sm ${i % 2 === 0 || i % 7 === 0 ? "bg-[#1d5946]" : "bg-[#d6f4ad]"}`} />
                      ))}
                    </div>
                    <span className="absolute rounded-lg bg-[#1d5946] px-2 py-1 text-[10px] font-bold text-white shadow">StayKids</span>
                  </div>
                  <p className="mt-3 text-xs font-bold text-[#287555]">SK-PAIR-{dynamicPin}</p>
                  <p className="mt-1 text-[11px] text-[#687b74]">Scan this QR Code using child device camera</p>
                </div>
              )}

              {role === "child" && pairMode === "pin" && (
                <div className="space-y-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={inputPin}
                    onChange={(e) => setInputPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="Enter 6-digit PIN"
                    className="w-full text-center tracking-[.3em] font-mono text-2xl font-bold rounded-2xl border border-[#a9c9b2] bg-[#f3faee] py-4 text-[#287555] focus:outline-none focus:ring-2 focus:ring-[#287555]"
                  />
                  <p className="text-[11px] text-center text-[#71807a]">Single-use security PIN from parent phone</p>
                </div>
              )}

              {role === "child" && pairMode === "qr" && (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-[#a9c9b2] bg-[#172d24] p-5 text-white text-center">
                  <div className="relative flex h-32 w-32 items-center justify-center rounded-2xl border-2 border-dashed border-[#d6f4ad] bg-black/40">
                    <span className="text-3xl animate-pulse">📷</span>
                    <div className="absolute inset-x-2 top-1/2 h-0.5 bg-[#d6f4ad] shadow-[0_0_8px_#d6f4ad]" />
                  </div>
                  <button
                    onClick={() => {
                      setInputPin(dynamicPin)
                      setQrScanned(true)
                    }}
                    className="mt-3 rounded-xl bg-[#d6f4ad] px-4 py-2 text-xs font-bold text-[#17352b] hover:bg-[#c3e895] transition"
                  >
                    {qrScanned ? "QR Code Scanned ✓ (SK-PAIR)" : "📷 Tap to Scan Parent QR Code"}
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 2 && role === "child" && (
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-[#a9c9b2] bg-[#f3faee] p-4 space-y-3">
                <div className="text-center">
                  <span className="rounded-full bg-[#d6f4ad] px-2.5 py-0.5 text-[10px] font-bold text-[#17352b]">
                    🛡️ Single-Time System Setup Checklist
                  </span>
                  <p className="text-xs font-bold text-[#172226] mt-1.5">Child Device System Permissions</p>
                  <p className="text-[11px] text-[#687b74]">
                    প্রতিটি বাটনে চাপ দিলে ফোনের রিয়েল Settings পেজ খুলে যাবে এবং অভিভাবক ম্যানুয়ালি পারমিশন অন করতে পারবেন।
                  </p>
                </div>

                <div className="space-y-2 pt-1 text-left text-xs">
                  {/* Permission 1: Accessibility Service */}
                  <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-[#d2e2d7] shadow-sm">
                    <div>
                      <p className="font-bold text-[#172226]">1. Accessibility Service</p>
                      <p className="text-[10px] text-[#71807a]">Enables app blocking & remote assistance</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAccEnabled(true)
                        setGuideModal({
                          isOpen: true,
                          title: "1. Accessibility Service Access",
                          steps: [
                            "নিচে 'Open System Settings Now' বাটন চাপুন।",
                            "Android Settings খুলে গেলে 'Installed Apps' (বা Downloaded Services) এ ঢুকুন।",
                            "'StayKids Service' খুঁজে বের করে ট্যাপ করুন।",
                            "উপরে থাকা সুইচ বাটনটি অন (Allow/Enable) করে দিন।",
                          ],
                          onOpenSettings: async () => {
                            await openAccessibilitySettings().catch(() => {})
                          },
                        })
                      }}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                        accEnabled ? "bg-[#287555] text-white" : "bg-[#d6f4ad] text-[#17352b] hover:bg-[#c3e895]"
                      }`}
                    >
                      {accEnabled ? "Enabled ✓" : "⚙️ Grant"}
                    </button>
                  </div>

                  {/* Permission 2: Disable Battery Saver Optimization */}
                  <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-[#d2e2d7] shadow-sm">
                    <div>
                      <p className="font-bold text-[#172226]">2. Battery Saver (No Restrictions)</p>
                      <p className="text-[10px] text-[#71807a]">Prevents Xiaomi/Samsung from killing background service</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setBatteryOptDisabled(true)
                        setGuideModal({
                          isOpen: true,
                          title: "2. Battery Saver (No Restrictions)",
                          steps: [
                            "নিচে 'Open System Settings Now' বাটন চাপুন।",
                            "ফোনের Battery Optimization তালিকার অ্যাপসগুলো আসবে।",
                            "'StayKids' অ্যাপটি বেছে নিয়ে 'No Restrictions' বা 'Don't optimize' দিন।",
                            "এর ফলে শাওমি/স্যামসাং ব্যাকগ্রাউন্ডে সার্ভিস বন্ধ করবে না।",
                          ],
                          onOpenSettings: async () => {
                            await requestDisableBatteryOptimization().catch(() => {})
                          },
                        })
                      }}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                        batteryOptDisabled ? "bg-[#287555] text-white" : "bg-[#d6f4ad] text-[#17352b] hover:bg-[#c3e895]"
                      }`}
                    >
                      {batteryOptDisabled ? "Disabled ✓" : "🔋 Allow"}
                    </button>
                  </div>

                  {/* Permission 3: Anti-Uninstall Device Admin */}
                  <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-[#d2e2d7] shadow-sm">
                    <div>
                      <p className="font-bold text-[#172226]">3. Device Admin Protection</p>
                      <p className="text-[10px] text-[#71807a]">Prevents child from uninstalling app</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminEnabled(true)
                        setGuideModal({
                          isOpen: true,
                          title: "3. Device Admin Protection",
                          steps: [
                            "নিচে 'Open System Settings Now' বাটন চাপুন।",
                            "ডিভাইস এডমিন সুরক্ষা অ্যাক্টিভ করার পপ-আপ স্ক্রিন আসবে।",
                            "নিচের 'Activate this device admin app' বাটনে চাপুন।",
                          ],
                          onOpenSettings: async () => {
                            await requestEnableDeviceAdmin().catch(() => {})
                          },
                        })
                      }}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                        adminEnabled ? "bg-[#287555] text-white" : "bg-[#d6f4ad] text-[#17352b] hover:bg-[#c3e895]"
                      }`}
                    >
                      {adminEnabled ? "Protected ✓" : "🔒 Protect"}
                    </button>
                  </div>

                  {/* Permission 4: Display Over Other Apps (Overlay) */}
                  <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-[#d2e2d7] shadow-sm">
                    <div>
                      <p className="font-bold text-[#172226]">4. Display Over Other Apps</p>
                      <p className="text-[10px] text-[#71807a]">Displays instant "App Blocked" overlay</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOverlayGranted(true)
                        setGuideModal({
                          isOpen: true,
                          title: "4. Display Over Other Apps (Overlay)",
                          steps: [
                            "নিচে 'Open System Settings Now' বাটন চাপুন।",
                            "'Display Over Apps' তালিকার থেকে 'StayKids' অ্যাপটি সিলেক্ট করুন।",
                            "'Allow display over other apps' পারমিশন সুইচটি অন করে দিন।",
                          ],
                          onOpenSettings: async () => {
                            await requestOverlayPermission().catch(() => {})
                          },
                        })
                      }}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                        overlayGranted ? "bg-[#287555] text-white" : "bg-[#d6f4ad] text-[#17352b] hover:bg-[#c3e895]"
                      }`}
                    >
                      {overlayGranted ? "Allowed ✓" : "🖥️ Overlay"}
                    </button>
                  </div>

                  {/* Permission 5: Camera & Surroundings Snapshot */}
                  <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-[#d2e2d7] shadow-sm">
                    <div>
                      <p className="font-bold text-[#172226]">5. Camera Access</p>
                      <p className="text-[10px] text-[#71807a]">Enables silent camera surroundings snapshot in emergency</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await requestCameraPermission()
                        if (res.granted) setCameraGranted(true)
                      }}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                        cameraGranted ? "bg-[#287555] text-white" : "bg-[#d6f4ad] text-[#17352b] hover:bg-[#c3e895]"
                      }`}
                    >
                      {cameraGranted ? "Granted ✓" : "📷 Camera"}
                    </button>
                  </div>

                  {/* Permission 6: Live GPS Location */}
                  <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-[#d2e2d7] shadow-sm">
                    <div>
                      <p className="font-bold text-[#172226]">6. Fine GPS Location</p>
                      <p className="text-[10px] text-[#71807a]">Enables real-time location tracking & geofencing</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await requestLocationPermission()
                        if (res.granted) setLocationGranted(true)
                      }}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                        locationGranted ? "bg-[#287555] text-white" : "bg-[#d6f4ad] text-[#17352b] hover:bg-[#c3e895]"
                      }`}
                    >
                      {locationGranted ? "Granted ✓" : "📍 Location"}
                    </button>
                  </div>

                  {/* Permission 7: Microphone & Audio Stream */}
                  <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-[#d2e2d7] shadow-sm">
                    <div>
                      <p className="font-bold text-[#172226]">7. Microphone Access</p>
                      <p className="text-[10px] text-[#71807a]">Enables one-way surroundings audio monitoring</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await requestMicrophonePermission()
                        if (res.granted) setMicGranted(true)
                      }}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                        micGranted ? "bg-[#287555] text-white" : "bg-[#d6f4ad] text-[#17352b] hover:bg-[#c3e895]"
                      }`}
                    >
                      {micGranted ? "Granted ✓" : "🎙️ Microphone"}
                    </button>
                  </div>

                  {/* Permission 8: MediaProjection Screen Share Priming */}
                  <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-[#d2e2d7] shadow-sm">
                    <div>
                      <p className="font-bold text-[#172226]">8. MediaProjection Screen Share</p>
                      <p className="text-[10px] text-[#71807a]">One-time system consent for live HD screen stream</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await startNativeScreenShare()
                        if (res.success) setScreenCaptureGranted(true)
                      }}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                        screenCaptureGranted ? "bg-[#287555] text-white" : "bg-[#d6f4ad] text-[#17352b] hover:bg-[#c3e895]"
                      }`}
                    >
                      {screenCaptureGranted ? "Granted ✓" : "📱 Screen Share"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <PermissionInstructionModal
            isOpen={guideModal.isOpen}
            onClose={() => setGuideModal((prev) => ({ ...prev, isOpen: false }))}
            title={guideModal.title}
            steps={guideModal.steps}
            onOpenSettings={guideModal.onOpenSettings}
          />
          <button
            onClick={handleNextStep}
            disabled={loading}
            className="mt-8 w-full rounded-2xl bg-[#287555] py-4 text-sm font-bold text-white hover:bg-[#1f5c43] disabled:opacity-50 transition"
          >
            {loading ? "Verifying with StayKids Server..." : step === 2 ? "Complete Setup →" : "Continue →"}
          </button>
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="mt-3 w-full py-2 text-sm font-bold text-[#63726f] hover:underline">
              ← Back
            </button>
          )}
        </div>
      </section>
    </main>
  )
}
