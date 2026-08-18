package com.staykids.parent;

import android.content.Context;
import android.content.Intent;
import android.media.projection.MediaProjection;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;
import org.webrtc.Camera1Enumerator;
import org.webrtc.Camera2Enumerator;
import org.webrtc.CameraEnumerator;
import org.webrtc.CameraVideoCapturer;
import org.webrtc.DataChannel;
import org.webrtc.DefaultVideoDecoderFactory;
import org.webrtc.DefaultVideoEncoderFactory;
import org.webrtc.EglBase;
import org.webrtc.IceCandidate;
import org.webrtc.MediaConstraints;
import org.webrtc.MediaStream;
import org.webrtc.PeerConnection;
import org.webrtc.PeerConnectionFactory;
import org.webrtc.RtpReceiver;
import org.webrtc.ScreenCapturerAndroid;
import org.webrtc.SdpObserver;
import org.webrtc.SessionDescription;
import org.webrtc.SurfaceTextureHelper;
import org.webrtc.VideoCapturer;
import org.webrtc.VideoSource;
import org.webrtc.VideoTrack;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class StayKidsWebRTCManager {

    private static final String TAG = "StayKidsWebRTCManager";
    private static StayKidsWebRTCManager instance;

    private final Context appContext;
    private PeerConnectionFactory factory;
    private PeerConnection peerConnection;
    private VideoSource videoSource;
    private VideoTrack videoTrack;
    private VideoCapturer videoCapturer;
    private SurfaceTextureHelper textureHelper;

    private boolean isInitialized = false;
    private final Set<String> appliedCandidates = new HashSet<>();
    private WebRTCSignalListener signalListener;

    public interface WebRTCSignalListener {
        void sendSignal(JSONObject signalData);
    }

    public static synchronized StayKidsWebRTCManager getInstance(Context context) {
        if (instance == null) {
            instance = new StayKidsWebRTCManager(context.getApplicationContext());
        }
        return instance;
    }

    private StayKidsWebRTCManager(Context context) {
        this.appContext = context;
        try {
            PeerConnectionFactory.InitializationOptions initializationOptions =
                PeerConnectionFactory.InitializationOptions.builder(context)
                    .setEnableInternalTracer(true)
                    .createInitializationOptions();
            PeerConnectionFactory.initialize(initializationOptions);

            EglBase.Context eglBaseContext = EglBase.create().getEglBaseContext();
            DefaultVideoEncoderFactory encoderFactory = new DefaultVideoEncoderFactory(eglBaseContext, true, true);
            DefaultVideoDecoderFactory decoderFactory = new DefaultVideoDecoderFactory(eglBaseContext);

            factory = PeerConnectionFactory.builder()
                .setVideoEncoderFactory(encoderFactory)
                .setVideoDecoderFactory(decoderFactory)
                .createPeerConnectionFactory();

            isInitialized = true;
            Log.i(TAG, "WebRTC PeerConnectionFactory initialized.");
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize WebRTC: " + e.getMessage());
        }
    }

    public void setSignalListener(WebRTCSignalListener listener) {
        this.signalListener = listener;
    }

    private void setupPeerConnection() {
        PeerConnection.IceServer stunServer1 = PeerConnection.IceServer
            .builder("stun:stun.l.google.com:19302")
            .createIceServer();
        PeerConnection.IceServer stunServer2 = PeerConnection.IceServer
            .builder("stun:stun1.l.google.com:19302")
            .createIceServer();
        PeerConnection.IceServer turnServer1 = PeerConnection.IceServer
            .builder("turn:openrelay.metered.ca:80")
            .setUsername("openrelayproject")
            .setPassword("openrelayproject")
            .createIceServer();
        PeerConnection.IceServer turnServer2 = PeerConnection.IceServer
            .builder("turn:openrelay.metered.ca:443")
            .setUsername("openrelayproject")
            .setPassword("openrelayproject")
            .createIceServer();
        PeerConnection.IceServer turnServer3 = PeerConnection.IceServer
            .builder("turn:openrelay.metered.ca:443?transport=tcp")
            .setUsername("openrelayproject")
            .setPassword("openrelayproject")
            .createIceServer();

        List<PeerConnection.IceServer> iceServers = java.util.Arrays.asList(stunServer1, stunServer2, turnServer1, turnServer2, turnServer3);
        PeerConnection.RTCConfiguration rtcConfig = new PeerConnection.RTCConfiguration(iceServers);

        peerConnection = factory.createPeerConnection(rtcConfig, new PeerConnection.Observer() {
            @Override
            public void onIceCandidate(IceCandidate candidate) {
                if (signalListener != null && candidate != null) {
                    try {
                        JSONObject candObj = new JSONObject();
                        candObj.put("sdpMid", candidate.sdpMid);
                        candObj.put("sdpMLineIndex", candidate.sdpMLineIndex);
                        candObj.put("candidate", candidate.sdp);

                        JSONObject payload = new JSONObject();
                        payload.put("type", "webrtc-signal");
                        payload.put("candidate", candObj);
                        signalListener.sendSignal(payload);
                    } catch (Exception e) {
                        Log.e(TAG, "Error encoding ICE candidate: " + e.getMessage());
                    }
                }
            }

            @Override public void onSignalingChange(PeerConnection.SignalingState state) {}
            @Override public void onIceConnectionChange(PeerConnection.IceConnectionState state) {
                Log.i(TAG, "Native WebRTC ICE Connection State: " + state.name());
            }
            @Override public void onIceConnectionReceivingChange(boolean receiving) {}
            @Override public void onIceGatheringChange(PeerConnection.IceGatheringState state) {}
            @Override public void onIceCandidatesRemoved(IceCandidate[] candidates) {}
            @Override public void onAddStream(MediaStream stream) {}
            @Override public void onRemoveStream(MediaStream stream) {}
            @Override public void onDataChannel(DataChannel channel) {}
            @Override public void onRenegotiationNeeded() {}
            @Override public void onAddTrack(RtpReceiver receiver, MediaStream[] streams) {}
        });

        if (peerConnection != null && videoTrack != null) {
            peerConnection.addTrack(videoTrack, Collections.singletonList("ARDAMS"));
        }
    }

    public void startScreenCaptureWebRTC(Intent projectionData, MediaProjection.Callback projectionCallback) {
        if (!isInitialized || factory == null) return;

        try {
            stopWebRTC();

            videoCapturer = new ScreenCapturerAndroid(projectionData, projectionCallback);
            textureHelper = SurfaceTextureHelper.create("WebRTCScreenCapturerThread", null);
            videoSource = factory.createVideoSource(videoCapturer.isScreencast());
            videoCapturer.initialize(textureHelper, appContext, videoSource.getCapturerObserver());
            videoCapturer.startCapture(540, 960, 15);

            videoTrack = factory.createVideoTrack("ARDAMSv0", videoSource);
            videoTrack.setEnabled(true);

            setupPeerConnection();

            Log.i(TAG, "WebRTC Screen Capture PeerConnection initialized.");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start WebRTC Screen Capture: " + e.getMessage());
        }
    }

    public void startCameraWebRTC(boolean useFrontCamera) {
        if (!isInitialized || factory == null) return;
        try {
            stopWebRTC();

            CameraEnumerator enumerator = Camera2Enumerator.isSupported(appContext) ? 
                new Camera2Enumerator(appContext) : new Camera1Enumerator(true);
            
            String[] deviceNames = enumerator.getDeviceNames();
            String selectedDeviceName = null;
            
            for (String deviceName : deviceNames) {
                if (enumerator.isFrontFacing(deviceName) == useFrontCamera) {
                    selectedDeviceName = deviceName;
                    break;
                }
            }
            if (selectedDeviceName == null && deviceNames.length > 0) {
                selectedDeviceName = deviceNames[0];
            }
            
            if (selectedDeviceName == null) {
                Log.e(TAG, "No camera found on device.");
                return;
            }

            videoCapturer = enumerator.createCapturer(selectedDeviceName, null);
            textureHelper = SurfaceTextureHelper.create("WebRTCCameraCapturerThread", null);
            videoSource = factory.createVideoSource(videoCapturer.isScreencast());
            videoCapturer.initialize(textureHelper, appContext, videoSource.getCapturerObserver());
            // Use 640x480 at 15fps for camera to save bandwidth
            videoCapturer.startCapture(640, 480, 15);

            videoTrack = factory.createVideoTrack("ARDAMSv0", videoSource);
            videoTrack.setEnabled(true);

            setupPeerConnection();

            Log.i(TAG, "WebRTC Camera Capture PeerConnection initialized.");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start WebRTC Camera Capture: " + e.getMessage());
        }
    }

    public void handleIncomingOffer(JSONObject offerObj) {
        if (peerConnection == null) return;
        try {
            String sdpStr = offerObj.optString("sdp");
            String typeStr = offerObj.optString("type", "offer");
            SessionDescription offerSdp = new SessionDescription(SessionDescription.Type.fromCanonicalForm(typeStr), sdpStr);

            peerConnection.setRemoteDescription(new SimpleSdpObserver() {
                @Override
                public void onSetSuccess() {
                    peerConnection.createAnswer(new SimpleSdpObserver() {
                        @Override
                        public void onCreateSuccess(SessionDescription answerSdp) {
                            peerConnection.setLocalDescription(new SimpleSdpObserver() {
                                @Override
                                public void onSetSuccess() {
                                    if (signalListener != null) {
                                        try {
                                            JSONObject ansObj = new JSONObject();
                                            ansObj.put("type", answerSdp.type.canonicalForm());
                                            ansObj.put("sdp", answerSdp.description);

                                            JSONObject payload = new JSONObject();
                                            payload.put("type", "webrtc-signal");
                                            payload.put("answer", ansObj);
                                            payload.put("signalState", "live");
                                            signalListener.sendSignal(payload);
                                        } catch (Exception e) {
                                            Log.e(TAG, "Error encoding SDP answer: " + e.getMessage());
                                        }
                                    }
                                }
                            }, answerSdp);
                        }
                    }, new MediaConstraints());
                }
            }, offerSdp);
        } catch (Exception e) {
            Log.e(TAG, "Failed to handle incoming offer: " + e.getMessage());
        }
    }

    public void handleIncomingCandidates(JSONArray candidatesArray) {
        if (peerConnection == null || candidatesArray == null) return;
        try {
            for (int i = 0; i < candidatesArray.length(); i++) {
                JSONObject candObj = candidatesArray.optJSONObject(i);
                if (candObj != null) {
                    String candidateStr = candObj.optString("candidate");
                    String sdpMid = candObj.optString("sdpMid");
                    int sdpMLineIndex = candObj.optInt("sdpMLineIndex", 0);

                    String uniqueKey = sdpMid + ":" + sdpMLineIndex + ":" + candidateStr;
                    if (!appliedCandidates.contains(uniqueKey)) {
                        appliedCandidates.add(uniqueKey);
                        IceCandidate iceCandidate = new IceCandidate(sdpMid, sdpMLineIndex, candidateStr);
                        peerConnection.addIceCandidate(iceCandidate);
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error handling incoming ICE candidates: " + e.getMessage());
        }
    }

    public void stopWebRTC() {
        try {
            if (videoCapturer != null) {
                try { videoCapturer.stopCapture(); } catch (Exception ignored) {}
                try { videoCapturer.dispose(); } catch (Exception ignored) {}
                videoCapturer = null;
            }
            if (textureHelper != null) {
                try { textureHelper.dispose(); } catch (Exception ignored) {}
                textureHelper = null;
            }
            if (videoSource != null) {
                try { videoSource.dispose(); } catch (Exception ignored) {}
                videoSource = null;
            }
            if (peerConnection != null) {
                try { peerConnection.close(); } catch (Exception ignored) {}
                peerConnection = null;
            }
            appliedCandidates.clear();
            Log.i(TAG, "WebRTC resources closed.");
        } catch (Exception e) {
            Log.e(TAG, "Error during stopWebRTC: " + e.getMessage());
        }
    }

    private static class SimpleSdpObserver implements SdpObserver {
        @Override public void onCreateSuccess(SessionDescription sdp) {}
        @Override public void onSetSuccess() {}
        @Override public void onCreateFailure(String error) { Log.e(TAG, "SDP Create Failure: " + error); }
        @Override public void onSetFailure(String error) { Log.e(TAG, "SDP Set Failure: " + error); }
    }
}
