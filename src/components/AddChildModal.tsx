import React, { useState } from "react"
import type { ChildDeviceInfo } from "../lib/staykids-api"
import { generatePairingCode } from "../lib/staykids-api"

export function AddChildModal({
  isOpen,
  onClose,
  onDeviceAdded,
}: {
  isOpen: boolean
  onClose: () => void
  onDeviceAdded: (newChild: ChildDeviceInfo) => void
}) {
  const [name, setName] = useState("")
  const [device, setDevice] = useState("")
  const [school, setSchool] = useState("")
  const [step, setStep] = useState<"form" | "pin">("form")
  const [pairingPin, setPairingPin] = useState<string | null>(null)
  const [isGeneratingPin, setIsGeneratingPin] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [createdChildId, setCreatedChildId] = useState<string | null>(null)

  if (!isOpen) return null

  const handleResetAndClose = () => {
    setName("")
    setDevice("")
    setSchool("")
    setStep("form")
    setPairingPin(null)
    setPinError(null)
    setIsGeneratingPin(false)
    setCreatedChildId(null)
    onClose()
  }

  const fetchPairingPin = async (childId: string) => {
    setIsGeneratingPin(true)
    setPinError(null)
    try {
      const res = await generatePairingCode(childId)
      if (res && res.pin) {
        setPairingPin(res.pin)
      } else {
        setPinError("Failed to generate backend pairing code. Please try again.")
      }
    } catch (err: any) {
      setPinError(err.message || "Network error generating pairing code. Please try again.")
    } finally {
      setIsGeneratingPin(false)
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !device || isGeneratingPin) return

    const childId = `child-${Date.now()}`
    const newChild: ChildDeviceInfo = {
      id: childId,
      name,
      device,
      school: school.trim() || undefined,
      location: "Home",
      battery: 100,
      online: true,
      protected: true,
    }

    onDeviceAdded(newChild)
    setCreatedChildId(childId)
    setStep("pin")
    await fetchPairingPin(childId)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl space-y-4 text-[#172226]">
        <div className="flex items-center justify-between border-b pb-3 border-[#e5ece8]">
          <h2 className="text-base font-bold text-[#172226]">
            {step === "form" ? "➕ Pair New Child Device" : "🔑 Registered Device PIN"}
          </h2>
          <button onClick={handleResetAndClose} className="rounded-full bg-[#edf2ef] p-1.5 text-xs font-bold text-[#5c6e67] hover:bg-[#dce6e1]">
            ✕
          </button>
        </div>

        {step === "form" ? (
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="text-xs font-bold text-[#586770]">Child Name (সন্তানের নাম)</label>
              <input
                type="text"
                required
                placeholder="e.g. Noah / Emma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#cbe0d3] p-2.5 text-xs focus:ring-2 focus:ring-[#287555] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#586770]">Device Model (ফোনের মডেল)</label>
              <input
                type="text"
                required
                placeholder="e.g. Galaxy A54 / Xiaomi Pad 6"
                value={device}
                onChange={(e) => setDevice(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#cbe0d3] p-2.5 text-xs focus:ring-2 focus:ring-[#287555] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#586770]">School Name (স্কুলের নাম - Optional)</label>
              <input
                type="text"
                placeholder="e.g. Greenfield International School"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#cbe0d3] p-2.5 text-xs focus:ring-2 focus:ring-[#287555] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isGeneratingPin}
              className="w-full rounded-xl bg-[#287555] py-3 text-xs font-bold text-white hover:bg-[#1f5c43] transition shadow disabled:opacity-50"
            >
              Confirm & Generate Pairing PIN →
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-dashed border-[#287555] bg-[#f3faee] p-4 text-center">
              <p className="text-[11px] font-bold text-[#287555]">Single-Use Registered Pairing PIN</p>
              
              {isGeneratingPin ? (
                <div className="my-3 flex items-center justify-center gap-2 text-xs font-bold text-[#287555]">
                  <span className="animate-spin text-lg">⏳</span> Registering pairing code with server...
                </div>
              ) : pinError ? (
                <div className="my-3 space-y-2">
                  <p className="text-xs font-bold text-[#c62828]">{pinError}</p>
                  <button
                    onClick={() => createdChildId && fetchPairingPin(createdChildId)}
                    className="rounded-lg bg-[#c62828] px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-[#b71c1c]"
                  >
                    🔄 Retry PIN Generation
                  </button>
                </div>
              ) : (
                <>
                  <p className="mt-2 font-mono text-2xl font-bold tracking-[.3em] text-[#17352b]">SK-{pairingPin}</p>
                  <p className="mt-2 text-[10px] leading-4 text-[#6a7c75]">
                    Enter this registered code on <span className="font-bold text-[#172226]">{name}</span>'s device during setup to pair instantly.
                  </p>
                </>
              )}
            </div>

            <button
              onClick={handleResetAndClose}
              className="w-full rounded-xl bg-[#287555] py-3 text-xs font-bold text-white hover:bg-[#1f5c43] transition shadow"
            >
              Done & Close ✓
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
