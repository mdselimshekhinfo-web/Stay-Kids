import React, { useState, useEffect } from "react"
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

// Fix for default Leaflet marker icons in React
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})
import type { StayKidsState } from "../lib/staykids-api"
import {
  captureNativeSnapshot,
  triggerRemoteTouch,
  startNativeScreenShare,
  stopNativeScreenShare,
  triggerRemoteNavigation,
  stopNativeAudioCapture,
  startNativeLiveCamera,
  stopNativeLiveCamera,
  listenCameraFrame,
} from "../lib/native"
import { triggerToast } from "./Toast"

export function Remote({ state, onAction }: { state: StayKidsState; onAction: (data: Record<string, unknown>) => void }) {
  const [tool, setTool] = useState<string | null>(null)
  const [camFacing, setCamFacing] = useState<"environment" | "user">("environment")
  const [cameraStreaming, setCameraStreaming] = useState(false)
  const [liveCamFrame, setLiveCamFrame] = useState<string | null>(null)
  const [streamMode, setStreamMode] = useState<"webrtc" | "jpeg">("webrtc")
  const [webrtcConnected, setWebrtcConnected] = useState(false)
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const pcRef = React.useRef<RTCPeerConnection | null>(null)
  const audio = state.remote.audioActive

  useEffect(() => {
    if (!cameraStreaming) return
    const unlisten = listenCameraFrame((frame) => {
      setLiveCamFrame(frame)
    })
    return () => unlisten()
  }, [cameraStreaming])

  // Part A: Complete WebRTC SDP Offer, Answer & Candidate Negotiation Logic
  const appliedCandidatesCount = React.useRef(0)

  useEffect(() => {
    if (tool !== "Screen Mirror" || !state.remote.mirrorStreamActive) {
      if (pcRef.current) {
        pcRef.current.close()
        pcRef.current = null
        appliedCandidatesCount.current = 0
        setWebrtcConnected(false)
      }
      return
    }

    if (!pcRef.current) {
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        })

        // Require receiving video track from child device
        pc.addTransceiver("video", { direction: "recvonly" })

        pc.ontrack = (event) => {
          if (videoRef.current && event.streams && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0]
            setWebrtcConnected(true)
          }
        }

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            onAction({ type: "webrtc-signal", candidate: event.candidate.toJSON() })
          }
        }

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
            setWebrtcConnected(true)
          } else if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
            setWebrtcConnected(false)
          }
        }

        pcRef.current = pc

        // 1. Create and send SDP Offer to child device
        pc.createOffer({ offerToReceiveVideo: true })
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            if (pc.localDescription) {
              onAction({
                type: "webrtc-signal",
                offer: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
                signalState: "connecting",
              })
            }
          })
          .catch((err) => console.warn("Failed to create WebRTC offer:", err))
      } catch (e) {
        console.warn("Browser WebRTC initialization fallback:", e)
      }
    }
  }, [tool, state.remote.mirrorStreamActive])

  // 2. Watch for state.remote.webrtcAnswer & state.remote.webrtcCandidates
  useEffect(() => {
    if (!pcRef.current) return

    // Apply SDP Answer from child device
    if (state.remote.webrtcAnswer && !pcRef.current.currentRemoteDescription) {
      const desc = new RTCSessionDescription(state.remote.webrtcAnswer as RTCSessionDescriptionInit)
      pcRef.current.setRemoteDescription(desc).catch((err) => console.warn("Error setting remote answer:", err))
    }

    // Apply backend-accumulated ICE candidates
    if (state.remote.webrtcCandidates && Array.isArray(state.remote.webrtcCandidates)) {
      const candidates = state.remote.webrtcCandidates
      for (let i = appliedCandidatesCount.current; i < candidates.length; i++) {
        const cand = candidates[i]
        if (cand && pcRef.current) {
          pcRef.current.addIceCandidate(new RTCIceCandidate(cand)).catch((err) => console.warn("Error adding candidate:", err))
        }
      }
      appliedCandidatesCount.current = candidates.length
    }
  }, [state.remote.webrtcAnswer, state.remote.webrtcCandidates])

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

  if (tool) {
    return (
      <div className="absolute inset-0 z-[100] bg-black flex flex-col p-4 space-y-4 overflow-y-auto text-white">
        <button
          type="button"
          onClick={async () => {
            if (tool === "Live Camera" && cameraStreaming) {
              await stopNativeLiveCamera()
              setCameraStreaming(false)
              setLiveCamFrame(null)
            }
            if (tool === "Screen Mirror" && state.remote.mirrorStreamActive) {
              await stopNativeScreenShare().catch(() => {})
              onAction({ type: "mirror-toggle", active: false })
              onAction({ type: "webrtc-signal", signalState: "idle", clearSignal: true })
            }
            setTool(null)
          }}
          className="absolute top-4 right-4 z-[110] text-xl text-white bg-white/20 rounded-full h-10 w-10 flex items-center justify-center backdrop-blur-md"
        >
          ✕
        </button>

        {tool === "Live Camera" && (
          <div className="flex flex-col flex-1 space-y-4 pt-14">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-[#feebee] px-2.5 py-0.5 text-[10px] font-bold text-[#c62828] animate-pulse flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#c62828]" /> 📷 SURROUNDINGS ({camFacing === "environment" ? "Rear Camera" : "Front Camera"})
              </span>
              <span className={`text-[10px] font-mono font-bold ${cameraStreaming && liveCamFrame ? "text-[#baf26b]" : cameraStreaming ? "text-[#ffe082] animate-pulse" : "text-[#869690]"}`}>
                {cameraStreaming && liveCamFrame ? "🔴 LIVE STREAMING" : cameraStreaming ? "🟡 CONNECTING..." : "⚪ IDLE"}
              </span>
            </div>
            
            <div className="relative flex flex-1 w-full flex-col items-center justify-center rounded-xl border border-[#287555] bg-[#0a0a0a] text-center overflow-hidden">
              {liveCamFrame && cameraStreaming ? (
                <div className="relative h-full w-full flex items-center justify-center">
                  <img src={liveCamFrame} alt="Live Camera Feed" className="flex-1 w-full h-full object-contain" />
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold text-[#baf26b] border border-[#baf26b]/40 backdrop-blur-md">
                    <span className="h-2 w-2 rounded-full bg-[#baf26b] animate-ping" />
                    <span>🔴 LIVE SURROUNDINGS FEED</span>
                  </div>
                </div>
              ) : cameraStreaming ? (
                <div className="space-y-3 p-6">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#baf26b] border-t-transparent" />
                  <p className="text-sm font-bold text-[#e1ece7]">Connecting to Child Camera...</p>
                </div>
              ) : (
                <div className="space-y-2 p-6">
                  <span className="text-4xl">📷</span>
                  <p className="text-sm font-bold text-[#e1ece7]">Live Camera Stream Ready</p>
                  <p className="text-xs text-[#869690] max-w-xs">
                    Tap "Start Live Camera" below to begin continuous video stream.
                  </p>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-2 pb-6">
              <button
                type="button"
                onClick={async () => {
                  if (!cameraStreaming) {
                    setCameraStreaming(true)
                    setLiveCamFrame(null)
                    const res = await startNativeLiveCamera(camFacing)
                    if (res.error) {
                      setCameraStreaming(false)
                      triggerToast("Camera Error: " + res.error, "error")
                    }
                  } else {
                    await stopNativeLiveCamera()
                    setCameraStreaming(false)
                    setLiveCamFrame(null)
                  }
                }}
                className={`w-full rounded-xl py-4 text-sm font-bold transition shadow-sm ${cameraStreaming ? "bg-[#c62828] text-white hover:bg-[#b71c1c]" : "bg-[#287555] text-white hover:bg-[#1f5c43]"}`}
              >
                {cameraStreaming ? "Stop Live Camera ⏹" : "Start Live Camera 🔴"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const newFacing = camFacing === "environment" ? "user" : "environment"
                  setCamFacing(newFacing)
                  if (cameraStreaming) {
                    await stopNativeLiveCamera()
                    setLiveCamFrame(null)
                    setCameraStreaming(true)
                    const res = await startNativeLiveCamera(newFacing)
                    if (res.error) {
                      setCameraStreaming(false)
                      triggerToast("Camera switch failed: " + res.error, "error")
                    }
                  }
                }}
                className="w-full rounded-xl bg-[#287555]/30 border border-[#287555] py-4 text-sm font-bold text-white hover:bg-[#287555]/50 transition"
              >
                🔄 Switch Camera
              </button>
            </div>
          </div>
        )}

        {tool === "Live GPS Map" && (
          <div className="flex flex-col flex-1 space-y-4 pt-14 pb-6">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-[#d6f4ad] px-2.5 py-0.5 text-[10px] font-bold text-[#17352b]">
                🗺️ OpenStreetMap (Live)
              </span>
              <span className="text-[10px] font-mono text-[#baf26b]">
                {lat.toFixed(4)}, {lng.toFixed(4)}
              </span>
            </div>
            
            <div className="relative flex-1 w-full rounded-xl overflow-hidden border border-[#287555] bg-white z-0">
              <MapContainer 
                center={[lat, lng]} 
                zoom={15} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[lat, lng]}>
                  <Popup>
                    <div className="text-center font-bold text-[#17352b]">
                      {childName}'s Device
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            </div>

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center rounded-xl bg-[#287555] py-4 text-sm font-bold text-white hover:bg-[#1f5c43] transition shadow-md"
            >
              📍 Open Route in Google Maps →
            </a>
          </div>
        )}

        {tool === "Screen Mirror" && (
          <div className="flex flex-col flex-1 space-y-4 pt-14 pb-6">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-[#d6f4ad] px-2.5 py-0.5 text-[10px] font-bold text-[#17352b]">
                📱 MediaProjection
              </span>
              <span className={`text-[10px] font-mono font-bold ${
                state.remote.connectionState === "live" || state.remote.liveFrame || webrtcConnected
                  ? "text-[#baf26b]"
                  : state.remote.connectionState === "connecting" || state.remote.connectionState === "requesting-consent"
                  ? "text-[#ffe082] animate-pulse"
                  : state.remote.connectionState === "denied"
                  ? "text-[#ef5350]"
                  : "text-[#869690]"
              }`}>
                {webrtcConnected && streamMode === "webrtc"
                  ? "⚡ WEBRTC LIVE"
                  : state.remote.liveFrame || state.remote.connectionState === "live"
                  ? "🔴 JPEG STREAMING"
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
                if (!state.remote.mirrorStreamActive && !state.remote.liveFrame && !webrtcConnected) return
                const rect = e.currentTarget.getBoundingClientRect()
                const clickX = e.clientX - rect.left
                const clickY = e.clientY - rect.top
                const targetW = state.child.screenWidth || 1080
                const targetH = state.child.screenHeight || 1920
                const targetX = Math.round((clickX / rect.width) * targetW)
                const targetY = Math.round((clickY / rect.height) * targetH)
                onAction({ type: "remote-touch", x: targetX, y: targetY, actionType: "TOUCH" })
                triggerRemoteTouch(targetX, targetY).catch(() => {
                  triggerToast("Touch command failed", "error")
                })
              }}
              className="relative flex flex-1 w-full cursor-crosshair flex-col items-center justify-center rounded-xl border border-[#287555] bg-[#0a0a0a] text-center select-none overflow-hidden"
            >
              {state.remote.liveFrame || webrtcConnected ? (
                <div className="relative h-full w-full flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className={`flex-1 w-full h-full object-contain ${webrtcConnected && streamMode === "webrtc" ? "block" : "hidden"}`}
                  />
                  <img
                    src={state.remote.liveFrame}
                    alt="Child Device Live Screen"
                    className={`flex-1 w-full h-full object-contain ${!webrtcConnected || streamMode === "jpeg" ? "block" : "hidden"}`}
                  />
                  <div className="absolute top-2 left-2 flex items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold text-[#baf26b] border border-[#baf26b]/40 backdrop-blur-md">
                      <span className="h-2 w-2 rounded-full bg-[#baf26b] animate-ping" />
                      <span>{webrtcConnected && streamMode === "webrtc" ? "⚡ WEBRTC SCREEN" : "🔴 JPEG MIRROR"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setStreamMode(streamMode === "webrtc" ? "jpeg" : "webrtc")
                      }}
                      className="rounded-full bg-black/70 px-2.5 py-1 text-[9px] font-mono text-[#ffe082] border border-[#ffe082]/40 backdrop-blur-md hover:bg-black/90 transition"
                    >
                      Mode: {streamMode.toUpperCase()} 🔄
                    </button>
                  </div>
                  {state.remote.lastTouchAction && (
                    <div className="absolute bottom-2 right-2 rounded-lg bg-[#287555]/90 px-2.5 py-1 text-[10px] font-mono text-white shadow-lg backdrop-blur-md">
                      ↗ Touch: {state.remote.lastTouchAction}
                    </div>
                  )}
                </div>
              ) : state.remote.mirrorStreamActive || state.remote.connectionState === "connecting" ? (
                <div className="space-y-3 p-6">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#baf26b] border-t-transparent" />
                  <p className="text-sm font-bold text-[#e1ece7]">Establishing Screen Session...</p>
                  <p className="text-xs text-[#869690] max-w-xs">Please grant consent on child device.</p>
                </div>
              ) : (
                <div className="space-y-2 p-6">
                  <span className="text-4xl">▣</span>
                  <p className="text-sm font-bold text-[#e1ece7]">Screen Mirror Ready</p>
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
                      triggerToast("Consent Error: " + res.error, "error")
                    } else {
                      onAction({ type: "mirror-toggle", active: true })
                      onAction({ type: "webrtc-signal", signalState: "connecting" })
                    }
                  } else {
                    await stopNativeScreenShare().catch(() => {})
                    onAction({ type: "mirror-toggle", active: false })
                    onAction({ type: "webrtc-signal", signalState: "idle" })
                  }
                }}
                className={`w-full rounded-xl py-4 text-sm font-bold transition shadow-sm ${
                  state.remote.mirrorStreamActive ? "bg-[#c62828] text-white hover:bg-[#b71c1c]" : "bg-[#287555] text-white hover:bg-[#1f5c43]"
                }`}
              >
                {state.remote.mirrorStreamActive ? "Stop Mirror ⏹" : "Start Mirror 🔴"}
              </button>

              <button
                type="button"
                onClick={() => {
                  onAction({ type: "remote-touch", actionType: "HOME" })
                  triggerRemoteNavigation("HOME").catch(() => {
                    triggerToast("Home gesture failed", "error")
                  })
                }}
                className="w-full rounded-xl bg-[#287555]/30 border border-[#287555] py-4 text-sm font-bold text-white hover:bg-[#287555]/50 transition"
              >
                🏠 Home Gesture
              </button>
            </div>
          </div>
        )}

        {tool === "One-way audio" && (
          <div className="flex flex-col flex-1 space-y-4 pt-14 pb-6">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-[#d6f4ad] px-2.5 py-0.5 text-[10px] font-bold text-[#17352b]">
                🎙️ Ambient Audio Stream
              </span>
              <span className={`text-[10px] font-mono font-bold ${audio ? "text-[#baf26b] animate-pulse" : "text-[#869690]"}`}>
                {audio ? "🔴 LIVE AUDIO MONITORING" : "⚪ IDLE"}
              </span>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center">
              {audio && state.remote.liveAudioChunk ? (
                <div className="space-y-4 w-full max-w-xs p-6 bg-[#0a0a0a] rounded-2xl border border-[#287555] text-center">
                  <div className="mx-auto h-16 w-16 bg-[#287555] rounded-full flex items-center justify-center animate-pulse">
                    <span className="text-3xl">🎙️</span>
                  </div>
                  <p className="text-sm font-bold text-[#baf26b]">
                    Streaming Live Audio...
                  </p>
                  <audio src={state.remote.liveAudioChunk} autoPlay controls className="w-full h-10 rounded-lg" />
                </div>
              ) : audio ? (
                <div className="p-4 text-center space-y-4">
                  <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#baf26b] border-t-transparent" />
                  <p className="text-sm font-bold text-[#cce0d5]">Connecting to microphone...</p>
                </div>
              ) : (
                <div className="text-center space-y-2 opacity-50">
                  <span className="text-6xl">🎙️</span>
                  <p className="text-sm font-bold mt-4">Audio Stream Ready</p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={async () => {
                if (audio) {
                  await stopNativeAudioCapture().catch(() => {
                    triggerToast("Failed to stop audio capture", "error")
                  })
                }
                onAction({ type: "audio-toggle", active: !audio })
              }}
              className={`w-full rounded-xl py-4 text-sm font-bold transition shadow-sm ${
                audio ? "bg-[#c62828] text-white hover:bg-[#b71c1c]" : "bg-[#287555] text-white hover:bg-[#1f5c43]"
              }`}
            >
              {audio ? "Stop Listening 🛑" : "Start Listening 🎙️"}
            </button>
          </div>
        )}

        {tool === "Snapshot" && (
          <div className="flex flex-col flex-1 space-y-6 pt-14 pb-6 items-center justify-center">
            <span className="text-7xl">📷</span>
            <p className="font-bold text-2xl text-white">Silent Snapshot</p>
            <p className="text-sm text-center text-[#cce0d5] px-4 max-w-sm">
              Capture a high-quality photo using the child device camera silently without triggering the screen.
            </p>
            <button
              onClick={() => {
                onAction({ type: "capture-snapshot", facing: camFacing })
                captureNativeSnapshot().catch(() => {
                  triggerToast("Snapshot failed — check child connection", "error")
                })
              }}
              className="w-full max-w-xs rounded-xl bg-[#287555] py-4 text-base font-bold text-white hover:bg-[#1f5c43] shadow-md transition active:scale-95"
            >
              Take Snapshot Now
            </button>
            {state.remote.lastSnapshotTime && (
              <p className="text-sm text-center text-[#baf26b] font-semibold bg-[#baf26b]/10 px-4 py-2 rounded-lg">
                ✓ Captured at {state.remote.lastSnapshotTime}
              </p>
            )}
          </div>
        )}

        {tool === "Remote access" && (
          <div className="flex flex-col flex-1 space-y-8 pt-14 pb-6 items-center justify-center">
            <p className="font-bold text-2xl text-white text-center">Remote Assistance<br/><span className="text-sm text-[#baf26b] font-normal mt-1 block">(Accessibility Control)</span></p>
            <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
              <button onClick={() => { onAction({ type: "remote-touch", actionType: "HOME" }); triggerRemoteNavigation("HOME").catch(() => triggerToast("Failed", "error")) }} className="rounded-xl bg-[#edf3ef] py-3 text-xs font-bold text-[#1d5946] hover:bg-[#dbe7de] transition active:scale-95">🏠 Home</button>
              <button onClick={() => { onAction({ type: "remote-touch", actionType: "BACK" }); triggerRemoteNavigation("BACK").catch(() => triggerToast("Failed", "error")) }} className="rounded-xl bg-[#edf3ef] py-3 text-xs font-bold text-[#1d5946] hover:bg-[#dbe7de] transition active:scale-95">⬅️ Back</button>
              <button onClick={() => { onAction({ type: "remote-touch", actionType: "RECENTS" }); triggerRemoteNavigation("RECENTS").catch(() => triggerToast("Failed", "error")) }} className="rounded-xl bg-[#edf3ef] py-3 text-xs font-bold text-[#1d5946] hover:bg-[#dbe7de] transition active:scale-95">📑 Recents</button>
              <button onClick={() => { onAction({ type: "remote-touch", actionType: "OPEN_SETTINGS" }); triggerRemoteNavigation("OPEN_SETTINGS").catch(() => triggerToast("Failed", "error")) }} className="rounded-xl bg-[#e3f2fd] py-3 text-xs font-bold text-[#1565c0] hover:bg-[#bbdefb] transition active:scale-95">⚙️ Settings</button>
              <button onClick={() => { onAction({ type: "remote-touch", actionType: "NOTIFICATIONS" }); triggerRemoteNavigation("NOTIFICATIONS").catch(() => triggerToast("Failed", "error")) }} className="rounded-xl bg-[#e3f2fd] py-3 text-xs font-bold text-[#1565c0] hover:bg-[#bbdefb] transition active:scale-95">🔔 Notifs</button>
              <button onClick={() => { onAction({ type: "remote-touch", actionType: "QUICK_SETTINGS" }); triggerRemoteNavigation("QUICK_SETTINGS").catch(() => triggerToast("Failed", "error")) }} className="rounded-xl bg-[#e3f2fd] py-3 text-xs font-bold text-[#1565c0] hover:bg-[#bbdefb] transition active:scale-95">🎛️ Toggles</button>
              <button onClick={() => { onAction({ type: "remote-touch", actionType: "SWIPE_UP" }); triggerRemoteNavigation("SWIPE_UP").catch(() => triggerToast("Failed", "error")) }} className="rounded-xl bg-[#fff3e0] py-3 text-xs font-bold text-[#e65100] hover:bg-[#ffe0b2] transition active:scale-95">⬆️ Swipe Up</button>
              <button onClick={() => { onAction({ type: "remote-touch", actionType: "SWIPE_DOWN" }); triggerRemoteNavigation("SWIPE_DOWN").catch(() => triggerToast("Failed", "error")) }} className="rounded-xl bg-[#fff3e0] py-3 text-xs font-bold text-[#e65100] hover:bg-[#ffe0b2] transition active:scale-95">⬇️ Swipe Dn</button>
              <button onClick={() => { onAction({ type: "remote-touch", actionType: "LOCK_SCREEN" }); triggerRemoteNavigation("LOCK_SCREEN").catch(() => triggerToast("Failed", "error")) }} className="rounded-xl bg-[#feebee] py-3 text-xs font-bold text-[#c62828] hover:bg-[#ffcdd2] transition active:scale-95">🔒 Lock</button>
            </div>
            {state.remote.lastTouchAction && (
              <p className="text-xs text-[#baf26b] font-semibold bg-[#baf26b]/10 px-4 py-2 rounded-lg">
                ✓ Executed: {state.remote.lastTouchAction}
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-24">
      <div>
        <p className="text-sm text-[#70808b]">{childName} · {state.child.device}</p>
        <h1 className="mt-1 text-[28px] font-bold tracking-[-.05em]">Remote Control</h1>
      </div>

      <div className="rounded-[28px] bg-[#1d5946] p-6 text-white shadow-sm flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <span className="text-9xl">🛡️</span>
        </div>
        <div className="relative z-10">
          <span className="rounded-full bg-[#d6f4ad] px-2.5 py-0.5 text-[10px] font-bold text-[#17352b]">
            Consent & Protection Active
          </span>
          <h2 className="mt-4 text-xl font-bold leading-tight">Advanced Child<br/>Surveillance</h2>
          <p className="mt-2 text-sm text-[#cce0d5] max-w-[80%]">Once initial permissions are granted, no repeated approval is needed for routine monitoring.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tools.map(([name, icon, desc]) => (
          <button
            key={name}
            onClick={() => {
              onAction({ type: "select-remote-tool", tool: name })
              setTool(name)
            }}
            className="rounded-[20px] border border-[#e1e7e8] bg-white p-4 text-left transition hover:border-[#43a878] hover:bg-[#f3faee] shadow-sm flex flex-col items-start"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f0f4f5] text-xl mb-3 transition">
              {icon}
            </div>
            <p className="text-sm font-bold text-[#172226]">{name}</p>
            <p className="mt-1 text-xs leading-snug text-[#71807a]">{desc}</p>
          </button>
        ))}
      </div>
      
      <p className="px-4 text-center text-xs leading-relaxed text-[#71807f]">
        Tap any tool above to launch in full screen.<br/>
        Permission set once during setup. Repeat approvals are not required.
      </p>
    </div>
  )
}
