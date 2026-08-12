import React, { useState, useEffect } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"

function MapTracker({ center }: { center: [number, number] }) {
  const map = useMap()
  const [lat, lng] = center
  useEffect(() => {
    map.flyTo([lat, lng], map.getZoom())
  }, [lat, lng, map])
  return null
}
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
  const [streamMode] = useState<"webrtc" | "jpeg">("webrtc")
  const [webrtcConnected, setWebrtcConnected] = useState(false)
  const [showQuitModal, setShowQuitModal] = useState(false)
  const [showSnackbar, setShowSnackbar] = useState(true)
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const pcRef = React.useRef<RTCPeerConnection | null>(null)
  const remote = state.remote || {}
  const audio = remote.audioActive

  // FlashGet Style Connection Overlay
  const FlashgetConnectionUI = ({
    status,
    title,
    onRetry,
    onBack,
    onSnapshot
  }: {
    status: "connecting" | "failed"
    title: string
    onRetry: () => void
    onBack: () => void
    onSnapshot?: () => void
  }) => {
    return (
      <div className="absolute inset-0 z-[150] bg-white flex flex-col items-center">
        {/* Header */}
        <div className="w-full flex items-center h-14 px-4 border-b border-[#f0f0f0]">
          <button onClick={onBack} className="p-2 text-black">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <h1 className="text-lg font-semibold text-black ml-4">{title}</h1>
        </div>

        {/* Illustration */}
        <div className="mt-20 flex items-center justify-center gap-4">
          <div className="w-24 h-48 rounded-[24px] border border-[#d8d3f6] bg-[#b8aef4] shadow-sm flex flex-col items-center justify-center relative">
            <div className="w-6 h-1 rounded-full bg-white/50 absolute top-3"></div>
            <span className="text-4xl">🏠</span>
          </div>
          
          <div className="flex flex-col items-center gap-1">
            {status === "connecting" ? (
              <div className="w-16 h-[2px] bg-gray-200 overflow-hidden relative">
                 <div className="absolute inset-0 bg-[#f48c42] w-1/2 animate-[ping_1.5s_infinite]"></div>
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#f48c42] flex items-center justify-center text-white text-3xl font-bold shadow-md">
                !
              </div>
            )}
          </div>

          <div className="w-24 h-48 rounded-[24px] border border-[#d8d3f6] bg-[#b8aef4] shadow-sm flex flex-col items-center justify-center relative">
             <div className="w-6 h-1 rounded-full bg-white/50 absolute top-3"></div>
             <span className="text-4xl">🚀</span>
          </div>
        </div>

        {/* Text Area */}
        <div className="mt-8 px-8 text-center max-w-sm">
          {status === "connecting" ? (
            <>
              <h2 className="text-lg font-bold text-[#333]">Connecting to the device...</h2>
              <p className="text-sm text-[#888] mt-3">It takes time to connect, please wait patiently</p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-[#333]">Connection failed (Channel 1)</h2>
              <p className="text-xs text-[#aaa] mt-1">{state.child?.name}</p>
              <div className="text-sm text-[#666] text-left mt-6 space-y-4 leading-relaxed">
                <p>You can click [Retry] to reconnect.<br/>If reconnection fails, you can use [Camera Snapshot] to take photos of the surroundings of your child's device for viewing.</p>
                <p>If the above solutions do not solve your problem, you can click [How to Fix] for support.</p>
              </div>
            </>
          )}
        </div>

        {/* Bottom Buttons */}
        {status === "failed" && (
          <div className="mt-auto mb-8 w-full px-6 flex flex-col gap-3">
            <button onClick={onRetry} className="w-full py-3.5 rounded-full bg-[#7c5ff0] text-white font-bold text-[15px] hover:bg-[#6c4be0] active:scale-95 transition">
              Retry
            </button>
            {onSnapshot && (
              <button onClick={onSnapshot} className="w-full py-3.5 rounded-full border border-[#7c5ff0] text-[#7c5ff0] font-bold text-[15px] hover:bg-[#f5f3ff] active:scale-95 transition">
                Camera Snapshot
              </button>
            )}
            <button className="w-full py-3.5 text-[#7c5ff0] font-bold text-[15px] mt-2">
              How to Fix
            </button>
          </div>
        )}
      </div>
    )
  }

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
    if (tool !== "Screen Mirror" || !remote.mirrorStreamActive) {
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
  }, [tool, remote.mirrorStreamActive])

  // 2. Watch for remote.webrtcAnswer & remote.webrtcCandidates
  useEffect(() => {
    if (!pcRef.current) return

    const applyWebRtcState = async () => {
      // Apply SDP Answer from child device
      if (remote.webrtcAnswer && !pcRef.current!.currentRemoteDescription && pcRef.current!.signalingState === 'have-local-offer') {
        try {
          const answerObj = typeof remote.webrtcAnswer === "string" ? JSON.parse(remote.webrtcAnswer) : remote.webrtcAnswer
          await pcRef.current!.setRemoteDescription(answerObj)
        } catch (err) {
          console.warn("Error setting remote answer:", err)
        }
      }

      // Apply backend-accumulated ICE candidates — only if remote description is set
      if (!pcRef.current!.remoteDescription) return // Wait until answer is applied
      if (remote.webrtcCandidates && Array.isArray(remote.webrtcCandidates)) {
        const candidates = remote.webrtcCandidates
        for (let i = appliedCandidatesCount.current; i < candidates.length; i++) {
          const cand = candidates[i]
          if (cand && pcRef.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(cand)).catch((err) => console.warn("Error adding candidate:", err))
          }
        }
        appliedCandidatesCount.current = candidates.length
      }
    }

    applyWebRtcState()
  }, [remote.webrtcAnswer, remote.webrtcCandidates, pcRef.current?.remoteDescription])

  // 2b. Cleanup WebRTC on unmount
  useEffect(() => {
    return () => {
      if (pcRef.current) {
        pcRef.current.close()
        pcRef.current = null
      }
      // Cleanup native streams
      import("./lib/native").then(({ stopNativeLiveCamera, stopNativeScreenShare, stopNativeAudioCapture }) => {
        stopNativeLiveCamera().catch(() => {})
        stopNativeScreenShare().catch(() => {})
        stopNativeAudioCapture().catch(() => {})
      })
    }
  }, [])

  // Auto-start Screen Mirror & Remote Access
  useEffect(() => {
    if ((tool === "Screen Mirror" || tool === "Remote access") && !remote.mirrorStreamActive && remote.connectionState !== "denied" && remote.connectionState !== "requesting-consent") {
      const initMirror = async () => {
        onAction({ type: "webrtc-signal", signalState: "requesting-consent" })
        const res = await startNativeScreenShare()
        if (res.error) {
          onAction({ type: "webrtc-signal", signalState: "denied" })
          triggerToast("Consent Error: " + res.error, "error")
        } else {
          onAction({ type: "mirror-toggle", active: true })
          onAction({ type: "webrtc-signal", signalState: "connecting" })
        }
      }
      const timeout = setTimeout(initMirror, 500)
      return () => clearTimeout(timeout)
    }
  }, [tool, remote.mirrorStreamActive, remote.connectionState])

  // Auto-start Live Camera
  useEffect(() => {
    if (tool === "Live Camera" && !cameraStreaming && remote.connectionState !== "denied" && remote.connectionState !== "connecting") {
      const initCam = async () => {
        onAction({ type: "webrtc-signal", signalState: "connecting" })
        setCameraStreaming(true)
        setLiveCamFrame(null)
        const res = await startNativeLiveCamera(camFacing)
        if (res.error) {
          setCameraStreaming(false)
          onAction({ type: "webrtc-signal", signalState: "denied" })
          triggerToast("Camera Error: " + res.error, "error")
        } else {
          onAction({ type: "webrtc-signal", signalState: "live" })
        }
      }
      const timeout = setTimeout(initCam, 500)
      return () => clearTimeout(timeout)
    }
  }, [tool, cameraStreaming, remote.connectionState])

  const tools = [
    ["Live Camera", "📷", "View child surroundings"],
    ["Live GPS Map", "🗺️", "Free OpenStreetMap tracking"],
    ["Screen Mirror", "▣", "Live view of child screen"],
    ["One-way audio", "🎙️", "Listen to background sound"],
    ["Remote access", "↗", "Assist approved settings"],
    ["Snapshot", "◉", "Silent camera snapshot"],
  ]

  const childName = state.child?.name || "Child Device"
  const lat = state.child?.coordinates?.lat || 23.8103
  const lng = state.child?.coordinates?.lng || 90.4125

  if (tool) {
    const isImmersive = tool === "Screen Mirror" || tool === "Live Camera" || tool === "Remote access"
    
    const handleQuitTool = async (force: boolean = false) => {
      if (!force && isImmersive && (remote.mirrorStreamActive || cameraStreaming || webrtcConnected)) {
        setShowQuitModal(true)
        return
      }
      setShowQuitModal(false)
      
      if (tool === "Live Camera" && cameraStreaming) {
        await stopNativeLiveCamera().catch(() => {})
        setCameraStreaming(false)
        setLiveCamFrame(null)
      }
      if ((tool === "Screen Mirror" || tool === "Remote access") && remote.mirrorStreamActive) {
        await stopNativeScreenShare().catch(() => {})
        onAction({ type: "mirror-toggle", active: false })
        onAction({ type: "webrtc-signal", signalState: "idle", clearSignal: true })
      }
      if (tool === "One-way audio" && remote.audioActive) {
        onAction({ type: "audio-toggle", active: false })
      }
      setTool(null)
    }

    return (
      <div className={`${isImmersive ? "fixed inset-0 w-screen h-screen" : "absolute inset-0"} z-[100] bg-black flex flex-col ${isImmersive ? "p-0 overflow-hidden" : "p-4 space-y-4 overflow-y-auto"} text-white`}>
        {!isImmersive && (
          <button
            type="button"
            onClick={() => handleQuitTool(true)}
            className="absolute top-4 right-4 z-[110] text-xl text-white bg-white/20 rounded-full h-10 w-10 flex items-center justify-center backdrop-blur-md"
          >
            ✕
          </button>
        )}
        
        {/* Quit Modal */}
        {showQuitModal && (
          <div className="absolute inset-0 z-[200] bg-black/60 flex items-center justify-center px-8">
            <div className="bg-white rounded-[24px] p-6 w-full max-w-sm text-center">
              <h3 className="text-[17px] font-bold text-black">{tool}</h3>
              <p className="text-sm text-[#666] mt-3">Are you sure you want to quit "{tool}"?</p>
              <div className="flex items-center gap-4 mt-8">
                <button onClick={() => setShowQuitModal(false)} className="flex-1 py-3 rounded-full border border-[#d1d1d1] text-[#666] font-bold">
                  Cancel
                </button>
                <button onClick={() => handleQuitTool(true)} className="flex-1 py-3 rounded-full bg-[#7c5ff0] text-white font-bold">
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {tool === "Live Camera" && (
          <div className="flex flex-col h-full w-full relative bg-black">
            {/* Overlay Back Button (Top Left) */}
            <button onClick={() => handleQuitTool()} className="absolute top-4 left-4 z-[120] p-2 text-white bg-black/40 rounded-full hover:bg-black/60 transition">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            
            {/* Connection States */}
            {remote.connectionState === "connecting" && (
              <FlashgetConnectionUI 
                status="connecting"
                title="Remote Camera"
                onBack={() => handleQuitTool(true)}
                onRetry={() => {}} 
              />
            )}
            
            {remote.connectionState === "denied" && (
               <FlashgetConnectionUI 
                status="failed"
                title="Remote Camera"
                onBack={() => handleQuitTool(true)}
                onSnapshot={() => {
                  onAction({ type: "capture-snapshot", facing: camFacing })
                  captureNativeSnapshot().then(() => triggerToast("Snapshot requested", "success")).catch(() => triggerToast("Snapshot failed", "error"))
                }}
                onRetry={async () => {
                  onAction({ type: "webrtc-signal", signalState: "connecting" })
                  setCameraStreaming(true)
                  setLiveCamFrame(null)
                  const res = await startNativeLiveCamera(camFacing)
                  if (res.error) {
                    setCameraStreaming(false)
                    onAction({ type: "webrtc-signal", signalState: "denied" })
                  } else {
                    onAction({ type: "webrtc-signal", signalState: "live" })
                  }
                }} 
              />
            )}

            {/* Immersive View */}
            <div className="relative flex-1 w-full h-full flex items-center justify-center select-none overflow-hidden">
               {liveCamFrame && cameraStreaming && (
                 <img
                    src={liveCamFrame}
                    alt="Live Camera Feed"
                    className="absolute inset-0 w-full h-full object-contain block"
                 />
               )}
            </div>
            
            {/* Overlay Controls (Bottom) */}
            {cameraStreaming && remote.connectionState === "live" && (
              <div className="absolute bottom-6 inset-x-0 flex items-center justify-between px-8 z-[120]">
                <button 
                  onClick={async () => {
                    const newFacing = camFacing === "environment" ? "user" : "environment"
                    setCamFacing(newFacing)
                    if (cameraStreaming) {
                      await stopNativeLiveCamera().catch(() => {})
                      setLiveCamFrame(null)
                      setCameraStreaming(true)
                      startNativeLiveCamera(newFacing).catch(() => {})
                    }
                  }}
                  className="p-3 bg-black/40 rounded-full text-white hover:bg-black/60 transition"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>
                </button>
                <button 
                  onClick={() => {
                    onAction({ type: "capture-snapshot", facing: camFacing })
                    captureNativeSnapshot().then(() => triggerToast("Snapshot saved", "success")).catch(() => triggerToast("Snapshot failed", "error"))
                  }}
                  className="p-3 bg-black/40 rounded-full text-white hover:bg-black/60 transition"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                </button>
              </div>
            )}
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
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapTracker center={[lat, lng]} />
                <Marker position={[lat, lng]}>
                  <Popup>
                    <div className="text-center font-bold text-[#17352b]">
                      {childName}'s location
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
          <div className="flex flex-col h-full w-full relative">
            {/* Overlay Back Button (Top Left) */}
            <button onClick={() => handleQuitTool()} className="absolute top-4 left-4 z-[120] p-2 text-white bg-black/40 rounded-full hover:bg-black/60 transition">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            
            {/* Connection States */}
            {(!remote.mirrorStreamActive || remote.connectionState === "connecting" || remote.connectionState === "requesting-consent") && remote.connectionState !== "denied" && (
              <FlashgetConnectionUI 
                status="connecting"
                title="Screen Mirroring"
                onBack={() => handleQuitTool(true)}
                onRetry={() => {}} 
              />
            )}
            
            {remote.connectionState === "denied" && (
               <FlashgetConnectionUI 
                status="failed"
                title="Screen Mirroring"
                onBack={() => handleQuitTool(true)}
                onRetry={async () => {
                   onAction({ type: "webrtc-signal", signalState: "requesting-consent" })
                   const res = await startNativeScreenShare()
                   if (res.error) {
                     onAction({ type: "webrtc-signal", signalState: "denied" })
                     triggerToast("Consent Error: " + res.error, "error")
                   } else {
                     onAction({ type: "mirror-toggle", active: true })
                     onAction({ type: "webrtc-signal", signalState: "connecting" })
                   }
                }} 
              />
            )}

            {/* Immersive View */}
            <div
              onPointerDown={(e) => {
                if (!remote.mirrorStreamActive && !remote.liveFrame && !webrtcConnected) return
                const mediaEl = (webrtcConnected && streamMode === "webrtc") ? videoRef.current : (e.currentTarget.querySelector('img') as HTMLImageElement);
                if (!mediaEl) return;
                const rect = mediaEl.getBoundingClientRect();
                let nativeW = 1080;
                let nativeH = 1920;
                if (mediaEl instanceof HTMLVideoElement) {
                    if (mediaEl.videoWidth === 0) return;
                    nativeW = mediaEl.videoWidth;
                    nativeH = mediaEl.videoHeight;
                } else if (mediaEl instanceof HTMLImageElement) {
                    if (mediaEl.naturalWidth === 0) return;
                    nativeW = mediaEl.naturalWidth;
                    nativeH = mediaEl.naturalHeight;
                }
                const scale = Math.min(rect.width / nativeW, rect.height / nativeH);
                const renderedW = nativeW * scale;
                const renderedH = nativeH * scale;
                const offsetX = (rect.width - renderedW) / 2;
                const offsetY = (rect.height - renderedH) / 2;
                const clickX = e.clientX - rect.left;
                const clickY = e.clientY - rect.top;
                if (clickX >= offsetX && clickX <= offsetX + renderedW && clickY >= offsetY && clickY <= offsetY + renderedH) {
                    const targetX = Math.round(((clickX - offsetX) / renderedW) * nativeW);
                    const targetY = Math.round(((clickY - offsetY) / renderedH) * nativeH);
                    onAction({ type: "remote-touch", x: targetX, y: targetY, actionType: "TOUCH" });
                    triggerRemoteTouch(targetX, targetY).catch(() => {
                        triggerToast("Touch command failed", "error");
                    });
                }
              }}
              className="relative flex-1 w-full h-full bg-black flex items-center justify-center select-none overflow-hidden"
            >
               {(remote.liveFrame || webrtcConnected) && (
                 <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className={`absolute inset-0 w-full h-full object-contain ${webrtcConnected && streamMode === "webrtc" ? "block" : "hidden"}`}
                  />
                  <img
                    src={remote.liveFrame || ""}
                    alt="Child Screen"
                    className={`absolute inset-0 w-full h-full object-contain ${!webrtcConnected || streamMode === "jpeg" ? "block" : "hidden"}`}
                  />
                 </>
               )}
            </div>
            
            {/* Overlay Controls (Bottom) */}
            {remote.mirrorStreamActive && (
              <>
                <div className="absolute bottom-6 inset-x-0 flex items-center justify-between px-8 z-[120]">
                  <button className="p-3 bg-black/40 rounded-full text-white hover:bg-black/60 transition">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                  </button>
                  <button 
                    onClick={() => {
                      captureNativeSnapshot().then(() => triggerToast("Snapshot saved", "success")).catch(() => triggerToast("Snapshot failed", "error"))
                    }}
                    className="p-3 bg-black/40 rounded-full text-white hover:bg-black/60 transition"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                  </button>
                </div>
                
                {/* Snackbar */}
                {showSnackbar && (
                  <div className="absolute bottom-24 inset-x-4 z-[120] bg-[#7c5ff0] text-white p-4 rounded-xl flex gap-3 shadow-xl">
                    <span className="flex-shrink-0 mt-0.5"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg></span>
                    <p className="text-[13px] leading-tight flex-1">
                      When using "Screen Mirroring", the screen will be black if the child's device screen is locked.
                    </p>
                    <button onClick={() => setShowSnackbar(false)} className="flex-shrink-0">✕</button>
                  </div>
                )}
              </>
            )}

            {/* Auto Start Logic */}
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
              {audio && remote.liveAudioChunk ? (
                <div className="space-y-4 w-full max-w-xs p-6 bg-[#0a0a0a] rounded-2xl border border-[#287555] text-center">
                  <div className="mx-auto h-16 w-16 bg-[#287555] rounded-full flex items-center justify-center animate-pulse">
                    <span className="text-3xl">🎙️</span>
                  </div>
                  <p className="text-sm font-bold text-[#baf26b]">
                    Streaming Live Audio...
                  </p>
                  <audio src={remote.liveAudioChunk} autoPlay controls className="w-full h-10 rounded-lg" />
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
            {remote.lastSnapshotTime && (
              <p className="text-sm text-center text-[#baf26b] font-semibold bg-[#baf26b]/10 px-4 py-2 rounded-lg">
                ✓ Captured at {remote.lastSnapshotTime}
              </p>
            )}
          </div>
        )}

        {tool === "Remote access" && (
          <div className="flex flex-col h-full w-full relative">
            {/* Overlay Back Button (Top Left) */}
            <button onClick={() => handleQuitTool()} className="absolute top-4 left-4 z-[120] p-2 text-white bg-black/40 rounded-full hover:bg-black/60 transition shadow-lg">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            
            {/* Connection States */}
            {(!remote.mirrorStreamActive || remote.connectionState === "connecting" || remote.connectionState === "requesting-consent") && remote.connectionState !== "denied" && (
              <FlashgetConnectionUI 
                status="connecting"
                title="Remote Access"
                onBack={() => handleQuitTool(true)}
                onRetry={() => {}} 
              />
            )}
            
            {remote.connectionState === "denied" && (
               <FlashgetConnectionUI 
                status="failed"
                title="Remote Access"
                onBack={() => handleQuitTool(true)}
                onRetry={async () => {
                   onAction({ type: "webrtc-signal", signalState: "requesting-consent" })
                   const res = await startNativeScreenShare()
                   if (res.error) {
                     onAction({ type: "webrtc-signal", signalState: "denied" })
                     triggerToast("Consent Error: " + res.error, "error")
                   } else {
                     onAction({ type: "mirror-toggle", active: true })
                     onAction({ type: "webrtc-signal", signalState: "connecting" })
                   }
                }} 
              />
            )}

            {/* Immersive View */}
            <div
              onPointerDown={(e) => {
                if (!remote.mirrorStreamActive && !remote.liveFrame && !webrtcConnected) return
                const mediaEl = (webrtcConnected && streamMode === "webrtc") ? videoRef.current : (e.currentTarget.querySelector('img') as HTMLImageElement);
                if (!mediaEl) return;
                const rect = mediaEl.getBoundingClientRect();
                let nativeW = 1080;
                let nativeH = 1920;
                if (mediaEl instanceof HTMLVideoElement) {
                    if (mediaEl.videoWidth === 0) return;
                    nativeW = mediaEl.videoWidth;
                    nativeH = mediaEl.videoHeight;
                } else if (mediaEl instanceof HTMLImageElement) {
                    if (mediaEl.naturalWidth === 0) return;
                    nativeW = mediaEl.naturalWidth;
                    nativeH = mediaEl.naturalHeight;
                }
                const scale = Math.min(rect.width / nativeW, rect.height / nativeH);
                const renderedW = nativeW * scale;
                const renderedH = nativeH * scale;
                const offsetX = (rect.width - renderedW) / 2;
                const offsetY = (rect.height - renderedH) / 2;
                const clickX = e.clientX - rect.left;
                const clickY = e.clientY - rect.top;
                if (clickX >= offsetX && clickX <= offsetX + renderedW && clickY >= offsetY && clickY <= offsetY + renderedH) {
                    const targetX = Math.round(((clickX - offsetX) / renderedW) * nativeW);
                    const targetY = Math.round(((clickY - offsetY) / renderedH) * nativeH);
                    onAction({ type: "remote-touch", x: targetX, y: targetY, actionType: "TOUCH" });
                    triggerRemoteTouch(targetX, targetY).catch(() => {
                        triggerToast("Touch command failed", "error");
                    });
                }
              }}
              className="relative flex-1 w-full h-full bg-black flex items-center justify-center select-none overflow-hidden cursor-crosshair"
            >
               {(remote.liveFrame || webrtcConnected) && (
                 <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className={`absolute inset-0 w-full h-full object-contain ${webrtcConnected && streamMode === "webrtc" ? "block" : "hidden"}`}
                  />
                  <img
                    src={remote.liveFrame || ""}
                    alt="Child Screen"
                    className={`absolute inset-0 w-full h-full object-contain ${!webrtcConnected || streamMode === "jpeg" ? "block" : "hidden"}`}
                  />
                 </>
               )}
            </div>
            
            {/* Overlay Navigation Controls (Bottom Dock) */}
            {remote.mirrorStreamActive && (
              <div className="absolute bottom-6 inset-x-6 z-[120] bg-black/70 backdrop-blur-md border border-white/10 rounded-3xl p-3 shadow-2xl flex flex-col gap-3">
                <div className="flex justify-between items-center px-4">
                   <p className="text-white text-xs font-bold opacity-70">REMOTE ASSISTANCE</p>
                   {remote.lastTouchAction && (
                     <span className="text-[10px] text-[#baf26b] bg-[#baf26b]/20 px-2 py-0.5 rounded-full">
                       {remote.lastTouchAction}
                     </span>
                   )}
                </div>
                <div className="flex items-center justify-between px-2 pb-1">
                  <button onClick={() => { onAction({ type: "remote-touch", actionType: "RECENTS" }); triggerRemoteNavigation("RECENTS").catch(() => triggerToast("Failed", "error")) }} className="p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition active:scale-95">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                  </button>
                  <button onClick={() => { onAction({ type: "remote-touch", actionType: "HOME" }); triggerRemoteNavigation("HOME").catch(() => triggerToast("Failed", "error")) }} className="p-4 bg-white/20 rounded-full text-white hover:bg-white/30 transition active:scale-95 shadow-lg">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>
                  </button>
                  <button onClick={() => { onAction({ type: "remote-touch", actionType: "BACK" }); triggerRemoteNavigation("BACK").catch(() => triggerToast("Failed", "error")) }} className="p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition active:scale-95">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                </div>
              </div>
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
