import React, { useState } from "react"
import type { StayKidsState } from "../lib/staykids-api"
import {
  captureNativeSnapshot,
  triggerRemoteTouch,
  startNativeScreenShare,
  stopNativeScreenShare,
  triggerRemoteNavigation,
  stopNativeAudioCapture,
} from "../lib/native"
import { triggerToast } from "./Toast"

export function Remote({ state, onAction }: { state: StayKidsState; onAction: (data: Record<string, unknown>) => void }) {
  const [tool, setTool] = useState("Live Camera")
  const [fullscreen, setFullscreen] = useState(true)
  const [activeSession, setActiveSession] = useState<string | null>("Live Camera")
  const [camFacing, setCamFacing] = useState<"environment" | "user">("environment")
  const audio = state.remote.audioActive

  const tools = [
    ["Live Camera", "📷", "View child surroundings"],
    ["Live GPS Map", "🗺️", "Free OpenStreetMap tracking"],
    ["Screen Mirror", "▣", "Live view of child screen"],
    ["One-way audio", "🎙️", "Listen to background sound"],
    ["Remote access", "↗", "Assist approved settings"],
    ["Snapshot", "◉", "Silent camera snapshot"],
  ]

  const childName = state.child.name || "Child Device"
  const lat = state.child.coordinates?.lat || 23.8103
  const lng = state.child.coordinates?.lng || 90.4125

  return (
    <div className="space-y-5 pb-24">
      <div>
        <p className="text-sm text-[#70808b]">{childName} · {state.child.device}</p>
        <h1 className="mt-1 text-[28px] font-bold tracking-[-.05em]">Remote Control & Surveillance</h1>
      </div>

      <div className="rounded-[28px] bg-[#1d5946] p-6 text-white shadow-sm flex items-center justify-between">
        <div>
          <span className="rounded-full bg-[#d6f4ad] px-2.5 py-0.5 text-[10px] font-bold text-[#17352b]">
            🛡️ Consent & System Protection Active
          </span>
          <h2 className="mt-2 text-lg font-bold">Child Surroundings & Live Feed</h2>
          <p className="mt-1 text-xs text-[#cce0d5]">Zero prompts required on child device in emergency.</p>
        </div>
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 text-2xl">
          📷
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tools.map(([name, icon, desc]) => (
          <button
            key={name}
            onClick={() => {
              setTool(name)
              setFullscreen(true)
              setActiveSession(name)
              onAction({ type: "select-remote-tool", tool: name })
            }}
            className={`rounded-[20px] border p-4 text-left transition ${tool === name ? "border-[#43a878] bg-[#f3faee] shadow-sm" : "border-[#e1e7e8] bg-white"}`}
          >
            <span className="text-xl">{icon}</span>
            <p className="mt-3 text-sm font-bold text-[#172226]">{name}</p>
            <p className="mt-0.5 text-xs leading-4 text-[#71807a]">{desc}</p>
          </button>
        ))}
      </div>

      <div className="rounded-[22px] border border-[#e1e7e8] bg-white p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-bold text-sm text-[#172226]">{tool}</p>
            <p className="text-xs text-[#72808a]">{activeSession === tool ? "Session Active (Live Connection)" : "Ready to launch"}</p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${activeSession === tool ? "bg-[#dbf6bf] text-[#27643e]" : "bg-[#edf1f3] text-[#586771]"}`}>
            {activeSession === tool ? "Live" : "Ready"}
          </span>
        </div>

        {/* 1. Live Camera Surroundings View */}
        {tool === "Live Camera" && (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col p-4 space-y-4 overflow-y-auto">
            <div className="relative overflow-hidden rounded-2xl bg-[#111c18] border border-[#287555] p-4 text-white text-center flex flex-col items-center justify-center flex-1">
              <button type="button" onClick={() => setFullscreen(false)} className="absolute top-4 right-4 z-[110] text-xl text-white bg-white/20 rounded-full h-10 w-10 flex items-center justify-center backdrop-blur-md">✕</button>
              <span className="absolute top-3 left-3 rounded-full bg-[#feebee] px-2.5 py-0.5 text-[10px] font-bold text-[#c62828] animate-pulse flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#c62828]" /> 🔴 SURROUNDINGS FEED ({camFacing === "environment" ? "Rear Camera" : "Front Camera"})
              </span>

              <div className="my-6 space-y-2">
                <span className="text-4xl">📷</span>
                <p className="text-xs font-bold text-[#d6f4ad]">Live Camera Stream & Instant Photo View</p>
                <p className="text-[11px] text-[#a1b8ae]">
                  সন্তান বিপদে পড়লে আশপাশের পরিস্থিতি রিয়েল-টাইমে দেখতে নিচে সাইলেন্ট স্ন্যাপশট বাটনে চাপ দিন।
                </p>
              </div>

              {state.remote.lastSnapshotTime && (
                <div className="w-full rounded-xl bg-black/60 p-2.5 text-[11px] text-[#d6f4ad]">
                  ✓ Last Surroundings Snapshot Captured: {state.remote.lastSnapshotTime}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCamFacing(camFacing === "environment" ? "user" : "environment")}
                className="flex-1 rounded-xl border border-[#a9c9b2] bg-[#f3faee] py-3 text-xs font-bold text-[#287555] hover:bg-[#e7f5e1] transition"
              >
                🔄 Switch ({camFacing === "environment" ? "Rear → Front" : "Front → Rear"})
              </button>
              <button
                type="button"
                onClick={() => {
                  onAction({ type: "capture-snapshot", facing: camFacing })
                  captureNativeSnapshot().catch(() => {
                    triggerToast("Snapshot failed — check child camera permissions & connection", "error")
                  })
                }}
                className="flex-1 rounded-xl bg-[#287555] py-3 text-xs font-bold text-white hover:bg-[#1f5c43] transition shadow-md"
              >
                📷 Capture Surroundings Photo
              </button>
            </div>
          </div>
        )}

        {/* 2. Free OpenStreetMap GPS Viewer */}
        {tool === "Live GPS Map" && (
          <div className="space-y-3 pt-1">
            <div className="overflow-hidden rounded-2xl border border-[#a9c9b2] bg-[#f3faee] p-3 text-center space-y-2">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[#d6f4ad] px-2.5 py-0.5 text-[10px] font-bold text-[#17352b]">
                  🗺️ OpenStreetMap (100% Free - No API Key Needed)
                </span>
                <span className="text-[10px] font-mono text-[#287555]">
                  {lat.toFixed(4)}, {lng.toFixed(4)}
                </span>
              </div>
              
              <div className="relative h-48 w-full rounded-xl overflow-hidden border border-[#d2e2d7] bg-white">
                <iframe
                  title="OpenStreetMap Live Child GPS Location"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  marginHeight={0}
                  marginWidth={0}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01}%2C${lat - 0.01}%2C${lng + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`}
                />
              </div>

              <p className="text-[11px] text-[#556962]">
                📍 {state.child.location || "Current Real GPS Location"} · Updated Live
              </p>
            </div>

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center rounded-xl bg-[#287555] py-3 text-xs font-bold text-white hover:bg-[#1f5c43] transition shadow-md"
            >
              📍 Open Route in Google Maps Navigation App →
            </a>
          </div>
        )}

        {activeSession === tool && tool === "Screen Mirror" && (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col p-4 space-y-3 overflow-y-auto text-white">
              <button type="button" onClick={() => setFullscreen(false)} className="absolute top-4 right-4 z-[110] text-xl text-white bg-white/20 rounded-full h-10 w-10 flex items-center justify-center backdrop-blur-md">✕</button>
            <div className="flex items-center justify-between pr-14">
              <span className="rounded-full bg-[#d6f4ad] px-2.5 py-0.5 text-[10px] font-bold text-[#17352b]">
                📱 MediaProjection + Live Stream
              </span>
              <span className={`text-[10px] font-mono font-bold ${
                state.remote.connectionState === "live" || state.remote.liveFrame
                  ? "text-[#baf26b]"
                  : state.remote.connectionState === "connecting" || state.remote.connectionState === "requesting-consent"
                  ? "text-[#ffe082] animate-pulse"
                  : state.remote.connectionState === "denied"
                  ? "text-[#ef5350]"
                  : "text-[#869690]"
              }`}>
                {state.remote.liveFrame || state.remote.connectionState === "live"
                  ? "🔴 LIVE STREAMING"
                  : state.remote.connectionState === "connecting"
                  ? "🟡 CONNECTING STREAM..."
                  : state.remote.connectionState === "requesting-consent"
                  ? "🟡 AWAITING CONSENT..."
                  : state.remote.connectionState === "denied"
                  ? "❌ CONSENT DENIED"
                  : "⚪ IDLE"}
              </span>
            </div>

            <div
              onClick={(e) => {
                if (!state.remote.mirrorStreamActive && !state.remote.liveFrame) return
                const rect = e.currentTarget.getBoundingClientRect()
                const clickX = e.clientX - rect.left
                const clickY = e.clientY - rect.top
                const targetW = (state as any).child?.screenWidth || 1080
                const targetH = (state as any).child?.screenHeight || 1920
                const targetX = Math.round((clickX / rect.width) * targetW)
                const targetY = Math.round((clickY / rect.height) * targetH)
                onAction({ type: "remote-touch", x: targetX, y: targetY, actionType: "TOUCH" })
                triggerRemoteTouch(targetX, targetY).catch(() => {
                  triggerToast("Touch command failed — check child device connection", "error")
                })
              }}
              className="relative flex flex-1 w-full cursor-crosshair flex-col items-center justify-center rounded-xl border border-[#287555] bg-black text-center select-none overflow-hidden"
            >
              {state.remote.liveFrame ? (
                <div className="relative h-full w-full flex items-center justify-center bg-black">
                  <img
                    src={state.remote.liveFrame}
                    alt="Child Device Live Screen"
                    className="flex-1 w-full h-full object-contain shadow-2xl"
                  />
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold text-[#baf26b] border border-[#baf26b]/40 backdrop-blur-md">
                    <span className="h-2 w-2 rounded-full bg-[#baf26b] animate-ping" />
                    <span>🔴 REAL-TIME CHILD SCREEN</span>
                  </div>
                  {state.remote.lastTouchAction && (
                    <div className="absolute bottom-2 right-2 rounded-lg bg-[#287555]/90 px-2.5 py-1 text-[10px] font-mono text-white shadow-lg backdrop-blur-md">
                      ↗ Touch Sent: {state.remote.lastTouchAction}
                    </div>
                  )}
                </div>
              ) : state.remote.mirrorStreamActive || state.remote.connectionState === "connecting" ? (
                <div className="space-y-3 p-6">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#baf26b] border-t-transparent" />
                  <p className="text-sm font-bold text-[#e1ece7]">Establishing Live Stream Screen Capture Session...</p>
                  <p className="text-xs text-[#869690] max-w-xs">
                    Please grant "Start now" consent on child device screen dialog.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 p-6">
                  <span className="text-4xl">▣</span>
                  <p className="text-sm font-bold text-[#e1ece7]">Screen Mirror Stream Disconnected</p>
                  <p className="text-xs text-[#869690] max-w-xs">
                    Tap "Start Live Screen Mirror" below to launch Android MediaProjection consent and start Live Stream video stream.
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (!state.remote.mirrorStreamActive) {
                    onAction({ type: "webrtc-signal", signalState: "requesting-consent" })
                    const res = await startNativeScreenShare()
                    if (res.error) {
                      onAction({ type: "webrtc-signal", signalState: "denied" })
                      triggerToast("Screen Share Consent Error: " + res.error, "error")
                    } else {
                      onAction({ type: "mirror-toggle", active: true })
                      onAction({ type: "webrtc-signal", signalState: "connecting" })
                    }
                  } else {
                    await stopNativeScreenShare().catch(() => {
                      triggerToast("Failed to stop screen share service cleanly", "warning")
                    })
                    onAction({ type: "mirror-toggle", active: false })
                    onAction({ type: "webrtc-signal", signalState: "idle" })
                  }
                }}
                className={`w-full rounded-xl py-3 text-xs font-bold transition shadow-sm ${
                  state.remote.mirrorStreamActive ? "bg-[#c62828] text-white hover:bg-[#b71c1c]" : "bg-[#287555] text-white hover:bg-[#1f5c43]"
                }`}
              >
                {state.remote.mirrorStreamActive ? "Stop Screen Mirror ⏹" : "Start Live Screen Mirror 🔴"}
              </button>

              <button
                type="button"
                onClick={() => {
                  onAction({ type: "remote-touch", actionType: "HOME" })
                  triggerRemoteNavigation("HOME").catch(() => {
                    triggerToast("Home gesture failed — check child device online", "error")
                  })
                }}
                className="w-full rounded-xl bg-[#287555]/30 border border-[#287555] py-3 text-xs font-bold text-white hover:bg-[#287555]/50 transition"
              >
                🏠 Home Gesture
              </button>
            </div>
          </div>
        )}

        {activeSession === tool && tool === "One-way audio" && (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col p-4 space-y-3 overflow-y-auto text-white">
            <button type="button" onClick={() => setFullscreen(false)} className="absolute top-4 right-4 z-[110] text-xl text-white bg-white/20 rounded-full h-10 w-10 flex items-center justify-center backdrop-blur-md">✕</button>
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-[#d6f4ad] px-2.5 py-0.5 text-[10px] font-bold text-[#17352b]">
                🎙️ Surroundings Ambient Audio Stream
              </span>
              <span className={`text-[10px] font-mono font-bold ${audio ? "text-[#baf26b] animate-pulse" : "text-[#869690]"}`}>
                {audio ? "🔴 LIVE AUDIO MONITORING" : "⚪ IDLE"}
              </span>
            </div>

            {audio && state.remote.liveAudioChunk ? (
              <div className="space-y-2 p-3 bg-black/60 rounded-xl border border-[#287555] text-center">
                <p className="text-xs font-bold text-[#baf26b] flex items-center justify-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#baf26b] animate-ping" />
                  Streaming Ambient Surroundings Audio...
                </p>
                <audio src={state.remote.liveAudioChunk} autoPlay controls className="w-full h-8" />
              </div>
            ) : audio ? (
              <div className="p-4 text-center space-y-2">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[#baf26b] border-t-transparent" />
                <p className="text-xs text-[#cce0d5]">Listening for surroundings audio chunks...</p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => {
                if (audio) stopNativeAudioCapture();
                onAction({ type: "audio-toggle", active: !audio })
              }}
              className={`w-full rounded-xl py-3.5 text-xs font-bold transition shadow-sm ${
                audio ? "bg-[#c62828] text-white hover:bg-[#b71c1c]" : "bg-[#287555] text-white hover:bg-[#1f5c43]"
              }`}
            >
              {audio ? "Stop One-Way Audio 🛑" : "Start One-Way Audio 🎙️"}
            </button>
          </div>
        )}

        {tool === "Snapshot" && (
          <div className="mt-5 space-y-3">
            <button
              onClick={() => {
                onAction({ type: "capture-snapshot" })
                captureNativeSnapshot().catch(() => {
                  triggerToast("Snapshot failed — check child camera permissions & connection", "error")
                })
              }}
              className="w-full rounded-2xl bg-[#287555] py-3.5 text-sm font-bold text-white hover:bg-[#1f5c43] transition shadow-md"
            >
              📷 Take Remote Camera Snapshot (Camera2)
            </button>
            {state.remote.lastSnapshotTime && (
              <p className="text-xs text-center text-[#287555] font-semibold">
                ✓ Snapshot captured at {state.remote.lastSnapshotTime}
              </p>
            )}
          </div>
        )}

        {tool === "Remote access" && (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 space-y-8 overflow-y-auto">
              <button type="button" onClick={() => setFullscreen(false)} className="absolute top-6 right-6 z-[110] text-xl text-white bg-white/20 rounded-full h-12 w-12 flex items-center justify-center backdrop-blur-md">✕</button>
            <p className="font-bold text-xl text-white">Full Device Remote Assistance (Accessibility Control)</p>
            <div className="grid grid-cols-3 gap-2 w-full max-w-lg gap-4">
              <button
                onClick={() => {
                  onAction({ type: "remote-touch", actionType: "HOME" })
                  triggerRemoteNavigation("HOME").catch(() => {
                    triggerToast("Home navigation failed — check child device online", "error")
                  })
                }}
                className="rounded-xl bg-[#edf3ef] py-2.5 text-xs font-bold text-[#1d5946] hover:bg-[#dbe7de] transition"
              >
                🏠 Home
              </button>
              <button
                onClick={() => {
                  onAction({ type: "remote-touch", actionType: "BACK" })
                  triggerRemoteNavigation("BACK").catch(() => {
                    triggerToast("Back navigation failed — check child device online", "error")
                  })
                }}
                className="rounded-xl bg-[#edf3ef] py-2.5 text-xs font-bold text-[#1d5946] hover:bg-[#dbe7de] transition"
              >
                ⬅️ Back
              </button>
              <button
                onClick={() => {
                  onAction({ type: "remote-touch", actionType: "RECENTS" })
                  triggerRemoteNavigation("RECENTS").catch(() => {
                    triggerToast("Recents navigation failed — check child device online", "error")
                  })
                }}
                className="rounded-xl bg-[#edf3ef] py-2.5 text-xs font-bold text-[#1d5946] hover:bg-[#dbe7de] transition"
              >
                📑 Recents
              </button>
              <button
                onClick={() => {
                  onAction({ type: "remote-touch", actionType: "OPEN_SETTINGS" })
                  triggerRemoteNavigation("OPEN_SETTINGS").catch(() => {
                    triggerToast("Settings command failed — check child device online", "error")
                  })
                }}
                className="rounded-xl bg-[#e3f2fd] py-2.5 text-xs font-bold text-[#1565c0] hover:bg-[#bbdefb] transition"
              >
                ⚙️ Settings
              </button>
              <button
                onClick={() => {
                  onAction({ type: "remote-touch", actionType: "NOTIFICATIONS" })
                  triggerRemoteNavigation("NOTIFICATIONS").catch(() => {
                    triggerToast("Notifications command failed — check child device online", "error")
                  })
                }}
                className="rounded-xl bg-[#e3f2fd] py-2.5 text-xs font-bold text-[#1565c0] hover:bg-[#bbdefb] transition"
              >
                🔔 Notifications
              </button>
              <button
                onClick={() => {
                  onAction({ type: "remote-touch", actionType: "QUICK_SETTINGS" })
                  triggerRemoteNavigation("QUICK_SETTINGS").catch(() => {
                    triggerToast("Toggles command failed — check child device online", "error")
                  })
                }}
                className="rounded-xl bg-[#e3f2fd] py-2.5 text-xs font-bold text-[#1565c0] hover:bg-[#bbdefb] transition"
              >
                🎛️ Toggles
              </button>
              <button
                onClick={() => {
                  onAction({ type: "remote-touch", actionType: "SWIPE_UP" })
                  triggerRemoteNavigation("SWIPE_UP").catch(() => {
                    triggerToast("Scroll Up command failed — check child device online", "error")
                  })
                }}
                className="rounded-xl bg-[#fff3e0] py-2.5 text-xs font-bold text-[#e65100] hover:bg-[#ffe0b2] transition"
              >
                ⬆️ Scroll Up
              </button>
              <button
                onClick={() => {
                  onAction({ type: "remote-touch", actionType: "SWIPE_DOWN" })
                  triggerRemoteNavigation("SWIPE_DOWN").catch(() => {
                    triggerToast("Scroll Down command failed — check child device online", "error")
                  })
                }}
                className="rounded-xl bg-[#fff3e0] py-2.5 text-xs font-bold text-[#e65100] hover:bg-[#ffe0b2] transition"
              >
                ⬇️ Scroll Down
              </button>
              <button
                onClick={() => {
                  onAction({ type: "remote-touch", actionType: "LOCK_SCREEN" })
                  triggerRemoteNavigation("LOCK_SCREEN").catch(() => {
                    triggerToast("Lock Phone command failed — check child device online", "error")
                  })
                }}
                className="rounded-xl bg-[#feebee] py-2.5 text-xs font-bold text-[#c62828] hover:bg-[#ffcdd2] transition"
              >
                🔒 Lock Phone
              </button>
            </div>
            {state.remote.lastTouchAction && (
              <p className="text-xs text-center text-[#287555] font-semibold">
                ✓ Executed: {state.remote.lastTouchAction}
              </p>
            )}
          </div>
        )}

        {activeSession !== tool && tool !== "Snapshot" ? (
          <button onClick={() => setActiveSession(tool)} className="mt-5 w-full rounded-2xl bg-[#287555] py-3.5 text-sm font-bold text-white hover:bg-[#1f5c43]">
            Start {tool} (Instant)
          </button>
        ) : (
          <button onClick={() => setActiveSession(null)} className="mt-5 w-full rounded-2xl bg-[#edf1f2] py-3.5 text-sm font-bold text-[#586771] hover:bg-[#e2e8ea]">
            Stop {tool}
          </button>
        )}
      </div>
      <p className="px-2 text-center text-xs leading-5 text-[#71807f]">Permission set once during setup. Repeat approvals are not required.</p>
    </div>
  )
}
