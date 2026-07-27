import React from "react"

export function PermissionInstructionModal({
  isOpen,
  onClose,
  title,
  steps,
  onOpenSettings,
}: {
  isOpen: boolean
  onClose: () => void
  title: string
  steps: string[]
  onOpenSettings: () => void
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl text-[#172226] space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b pb-3 border-[#e8f0eb]">
          <h3 className="font-bold text-base text-[#17352b] flex items-center gap-2">
            <span>🛡️</span> {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-full bg-[#edf3ef] text-xs font-bold text-[#556962] hover:bg-[#dbe7de]"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2.5 text-xs text-[#42524b]">
          <p className="font-bold text-[#172226] text-[11px] uppercase tracking-wider text-[#287555]">
            অভিভাবকের জন্য ম্যানুয়াল স্টেপ নির্দেশিকা:
          </p>
          {steps.map((step, idx) => (
            <div key={idx} className="flex gap-2.5 items-start bg-[#f3faee] p-2.5 rounded-xl border border-[#d2e2d7]">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#287555] text-[10px] font-bold text-white">
                {idx + 1}
              </span>
              <p className="leading-5 font-semibold text-[#17352b]">{step}</p>
            </div>
          ))}
        </div>

        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={async () => {
              try {
                await onOpenSettings()
              } finally {
                onClose()
              }
            }}
            className="w-full rounded-2xl bg-[#287555] py-3.5 text-xs font-bold text-white hover:bg-[#1f5c43] shadow-md transition"
          >
            ⚙️ Open System Settings Now →
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-center text-xs font-bold text-[#71807a] hover:underline"
          >
            Close Guide (বন্ধ করুন)
          </button>
        </div>
      </div>
    </div>
  )
}
