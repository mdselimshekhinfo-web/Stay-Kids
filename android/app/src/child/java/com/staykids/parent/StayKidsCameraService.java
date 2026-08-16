package com.staykids.parent;

import android.content.Context;
import android.graphics.ImageFormat;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraDevice;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CaptureRequest;
import android.media.Image;
import android.media.ImageReader;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Looper;
import android.util.Log;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.util.Collections;

public class StayKidsCameraService {

    private static final String TAG = "StayKidsCameraService";
    private static final long MAX_STREAM_DURATION_MS = 10 * 60 * 1000L; // 10 minutes max safety limit
    private final Context context;

    private volatile boolean isSnapshotInProgress = false;
    private volatile boolean isStreaming = false;

    private CameraDevice liveCameraDevice;
    private CameraCaptureSession liveSession;
    private ImageReader liveImageReader;
    private HandlerThread liveThread;
    private Handler liveHandler;
    private String currentFacing = "environment";
    private LiveFrameCallback frameCallback;

    private final Handler autoStopHandler = new Handler(Looper.getMainLooper());
    private final Runnable autoStopRunnable = () -> {
        if (isStreaming) {
            Log.w(TAG, "Live stream reached maximum safety duration (10 mins). Automatically stopping.");
            stopLiveStream();
        }
    };

    public StayKidsCameraService(Context context) {
        this.context = context;
    }

    public interface SnapshotCallback {
        void onSuccess(String filePath);
        void onError(String error);
    }

    public interface LiveFrameCallback {
        void onStarted();
        void onFrame(byte[] jpegData);
        void onError(String error);
    }

    public void captureSilentSnapshot(SnapshotCallback callback) {
        // A.3 Mutual exclusion check
        if (isStreaming) {
            callback.onError("Camera is currently in use for live streaming. Stop the live view first.");
            return;
        }
        if (isSnapshotInProgress) {
            callback.onError("A camera snapshot capture is already in progress.");
            return;
        }

        isSnapshotInProgress = true;
        CameraManager manager = (CameraManager) context.getSystemService(Context.CAMERA_SERVICE);
        if (manager == null) {
            isSnapshotInProgress = false;
            callback.onError("Camera service unavailable");
            return;
        }

        try {
            String cameraId = null;
            for (String id : manager.getCameraIdList()) {
                CameraCharacteristics characteristics = manager.getCameraCharacteristics(id);
                Integer facing = characteristics.get(CameraCharacteristics.LENS_FACING);
                if (facing != null && facing == CameraCharacteristics.LENS_FACING_FRONT) {
                    cameraId = id;
                    break;
                }
            }
            if (cameraId == null && manager.getCameraIdList().length > 0) {
                cameraId = manager.getCameraIdList()[0];
            }
            if (cameraId == null) {
                isSnapshotInProgress = false;
                callback.onError("No camera device found");
                return;
            }

            final HandlerThread backgroundThread = new HandlerThread("CameraBackground");
            backgroundThread.start();
            Handler backgroundHandler = new Handler(backgroundThread.getLooper());

            // A.1 Idempotent Thread Cleanup Helper
            final boolean[] bgThreadCleanedUp = new boolean[]{false};
            Runnable cleanupBgThread = () -> {
                synchronized (bgThreadCleanedUp) {
                    if (!bgThreadCleanedUp[0]) {
                        bgThreadCleanedUp[0] = true;
                        isSnapshotInProgress = false;
                        try { backgroundThread.quitSafely(); } catch (Exception ignored) {}
                    }
                }
            };

            ImageReader imageReader = ImageReader.newInstance(640, 480, ImageFormat.JPEG, 1);
            imageReader.setOnImageAvailableListener(reader -> {
                Image image = null;
                try {
                    image = reader.acquireLatestImage();
                    if (image != null) {
                        ByteBuffer buffer = image.getPlanes()[0].getBuffer();
                        byte[] bytes = new byte[buffer.remaining()];
                        buffer.get(bytes);

                        File file = new File(context.getCacheDir(), "snapshot_" + System.currentTimeMillis() + ".jpg");
                        FileOutputStream output = new FileOutputStream(file);
                        output.write(bytes);
                        output.close();

                        Log.i(TAG, "Snapshot captured successfully: " + file.getAbsolutePath());
                        callback.onSuccess(file.getAbsolutePath());
                    }
                } catch (Exception e) {
                    callback.onError("Failed to save snapshot: " + e.getMessage());
                } finally {
                    if (image != null) image.close();
                    cleanupBgThread.run();
                }
            }, backgroundHandler);

            final String selectedCameraId = cameraId;
            manager.openCamera(selectedCameraId, new CameraDevice.StateCallback() {
                @Override
                public void onOpened(CameraDevice camera) {
                    try {
                        CaptureRequest.Builder builder = camera.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE);
                        builder.addTarget(imageReader.getSurface());
                        camera.createCaptureSession(Collections.singletonList(imageReader.getSurface()), new CameraCaptureSession.StateCallback() {
                            @Override
                            public void onConfigured(CameraCaptureSession session) {
                                try {
                                    session.capture(builder.build(), new CameraCaptureSession.CaptureCallback() {
                                        @Override
                                        public void onCaptureCompleted(CameraCaptureSession captureSession, CaptureRequest request, android.hardware.camera2.TotalCaptureResult result) {
                                            try { captureSession.close(); } catch(Exception ignored) {}
                                            try { camera.close(); } catch(Exception ignored) {}
                                            try { imageReader.close(); } catch(Exception ignored) {}
                                        }
                                    }, backgroundHandler);
                                } catch (CameraAccessException e) {
                                    cleanupBgThread.run();
                                    callback.onError("Camera access exception during capture: " + e.getMessage());
                                }
                            }

                            @Override
                            public void onConfigureFailed(CameraCaptureSession session) {
                                try { camera.close(); } catch (Exception ignored) {}
                                try { imageReader.close(); } catch (Exception ignored) {}
                                cleanupBgThread.run();
                                callback.onError("Camera configuration failed");
                            }
                        }, backgroundHandler);
                    } catch (Exception e) {
                        cleanupBgThread.run();
                        callback.onError("Error setting up capture session: " + e.getMessage());
                    }
                }

                @Override
                public void onDisconnected(CameraDevice camera) {
                    try { camera.close(); } catch (Exception ignored) {}
                    cleanupBgThread.run();
                }

                @Override
                public void onError(CameraDevice camera, int error) {
                    try { camera.close(); } catch (Exception ignored) {}
                    cleanupBgThread.run();
                    callback.onError("Camera device error code: " + error);
                }
            }, backgroundHandler);

        } catch (Exception e) {
            isSnapshotInProgress = false;
            callback.onError("Camera exception: " + e.getMessage());
        }
    }

    public void startLiveStream(String facing, LiveFrameCallback callback) {
        // A.3 Mutual exclusion check
        if (isSnapshotInProgress) {
            callback.onError("Camera is currently in use for a snapshot capture. Please wait.");
            return;
        }

        if (isStreaming) {
            stopLiveStream();
        }
        this.currentFacing = facing;
        this.frameCallback = callback;
        this.isStreaming = true;

        // A.2 Schedule 10-minute auto-stop safety timer
        autoStopHandler.removeCallbacks(autoStopRunnable);
        autoStopHandler.postDelayed(autoStopRunnable, MAX_STREAM_DURATION_MS);
        
        CameraManager manager = (CameraManager) context.getSystemService(Context.CAMERA_SERVICE);
        if (manager == null) {
            cleanupLiveStreamResources();
            callback.onError("Camera service unavailable");
            return;
        }
        
        try {
            String cameraId = null;
            int targetFacing = "user".equals(facing) 
                ? CameraCharacteristics.LENS_FACING_FRONT 
                : CameraCharacteristics.LENS_FACING_BACK;
            
            for (String id : manager.getCameraIdList()) {
                CameraCharacteristics chars = manager.getCameraCharacteristics(id);
                Integer lensFacing = chars.get(CameraCharacteristics.LENS_FACING);
                if (lensFacing != null && lensFacing == targetFacing) {
                    cameraId = id;
                    break;
                }
            }
            if (cameraId == null && manager.getCameraIdList().length > 0) {
                cameraId = manager.getCameraIdList()[0];
            }
            if (cameraId == null) {
                cleanupLiveStreamResources();
                callback.onError("No camera found");
                return;
            }
            
            liveThread = new HandlerThread("LiveCameraThread");
            liveThread.start();
            liveHandler = new Handler(liveThread.getLooper());
            
            liveImageReader = ImageReader.newInstance(320, 240, ImageFormat.JPEG, 2);
            liveImageReader.setOnImageAvailableListener(reader -> {
                Image image = null;
                try {
                    image = reader.acquireLatestImage();
                    if (image != null && isStreaming && frameCallback != null) {
                        ByteBuffer buffer = image.getPlanes()[0].getBuffer();
                        byte[] bytes = new byte[buffer.remaining()];
                        buffer.get(bytes);
                        frameCallback.onFrame(bytes);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Frame capture error: " + e.getMessage());
                } finally {
                    if (image != null) image.close();
                }
            }, liveHandler);
            
            final String selectedId = cameraId;
            manager.openCamera(selectedId, new CameraDevice.StateCallback() {
                @Override
                public void onOpened(CameraDevice camera) {
                    liveCameraDevice = camera;
                    try {
                        CaptureRequest.Builder builder = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW);
                        builder.addTarget(liveImageReader.getSurface());
                        builder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE);
                        builder.set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON);
                        
                        camera.createCaptureSession(
                            Collections.singletonList(liveImageReader.getSurface()),
                            new CameraCaptureSession.StateCallback() {
                                @Override
                                public void onConfigured(CameraCaptureSession session) {
                                    liveSession = session;
                                    try {
                                        session.setRepeatingRequest(builder.build(), null, liveHandler);
                                        Log.i(TAG, "Live camera stream started (" + facing + ")");
                                        if (frameCallback != null) frameCallback.onStarted();
                                    } catch (CameraAccessException e) {
                                        if (frameCallback != null) frameCallback.onError("Repeating request failed: " + e.getMessage());
                                    }
                                }
                                @Override
                                public void onConfigureFailed(CameraCaptureSession session) {
                                    cleanupLiveStreamResources();
                                    if (frameCallback != null) frameCallback.onError("Camera config failed");
                                }
                            },
                            liveHandler
                        );
                    } catch (Exception e) {
                        cleanupLiveStreamResources();
                        if (frameCallback != null) frameCallback.onError("Session setup failed: " + e.getMessage());
                    }
                }
                
                @Override
                public void onDisconnected(CameraDevice camera) {
                    // A.4 Shared resource cleanup & state sync on disconnect
                    cleanupLiveStreamResources();
                }
                
                @Override
                public void onError(CameraDevice camera, int error) {
                    // A.4 Shared resource cleanup & state sync on camera error
                    LiveFrameCallback cb = frameCallback;
                    cleanupLiveStreamResources();
                    if (cb != null) cb.onError("Camera error: " + error);
                }
            }, liveHandler);
            
        } catch (SecurityException e) {
            cleanupLiveStreamResources();
            callback.onError("Camera permission not granted");
        } catch (Exception e) {
            cleanupLiveStreamResources();
            callback.onError("Camera exception: " + e.getMessage());
        }
    }

    public void stopLiveStream() {
        cleanupLiveStreamResources();
        Log.i(TAG, "Live camera stream stopped");
    }

    // A.4 Shared Private Cleanup Helper for Live Stream State & Hardware Resources
    private void cleanupLiveStreamResources() {
        isStreaming = false;
        autoStopHandler.removeCallbacks(autoStopRunnable);
        try { if (liveSession != null) { liveSession.close(); liveSession = null; } } catch (Exception ignored) {}
        try { if (liveCameraDevice != null) { liveCameraDevice.close(); liveCameraDevice = null; } } catch (Exception ignored) {}
        try { if (liveImageReader != null) { liveImageReader.close(); liveImageReader = null; } } catch (Exception ignored) {}
        try { if (liveThread != null) { liveThread.quitSafely(); liveThread = null; } } catch (Exception ignored) {}
        frameCallback = null;
    }

    public boolean isLiveStreaming() {
        return isStreaming;
    }
}
