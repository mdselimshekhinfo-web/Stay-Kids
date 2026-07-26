import React, { useEffect, useState } from "react"

export type ToastMessage = {
  id: string
  text: string
  type: "error" | "success" | "warning" | "info"
}

let toastListener: ((toast: ToastMessage) => void) | null = null

export function triggerToast(text: string, type: "error" | "success" | "warning" | "info" = "error") {
  if (toastListener) {
    toastListener({ id: String(Date.now() + Math.random()), text, type })
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    toastListener = (newToast) => {
      setToasts((prev) => [...prev.slice(-2), newToast]) // keep max 3 toasts
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id))
      }, 4000)
    }
    return () => {
      toastListener = null
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-sm px-4 space-y-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center justify-between gap-3 rounded-2xl p-3.5 text-xs font-bold shadow-xl border backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-200 ${
            t.type === "error"
              ? "bg-[#8b2318]/95 text-white border-[#ff8a80]"
              : t.type === "success"
              ? "bg-[#1d5946]/95 text-white border-[#baf26b]"
              : t.type === "warning"
              ? "bg-[#8c5b00]/95 text-white border-[#ffe082]"
              : "bg-[#172226]/95 text-white border-[#90caf9]"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>
              {t.type === "error" ? "⚠️" : t.type === "success" ? "✓" : t.type === "warning" ? "⚡" : "ℹ️"}
            </span>
            <p className="leading-4">{t.text}</p>
          </div>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] hover:bg-white/30"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
