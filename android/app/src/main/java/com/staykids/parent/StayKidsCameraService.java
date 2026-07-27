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
import android.util.Log;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.util.Collections;

public class StayKidsCameraService {

    private static final String TAG = "StayKidsCameraService";
    private final Context context;

    public StayKidsCameraService(Context context) {
        this.context = context;
    }

    public interface SnapshotCallback {
        void onSuccess(String filePath);
        void onError(String error);
    }

    public void captureSilentSnapshot(SnapshotCallback callback) {
        CameraManager manager = (CameraManager) context.getSystemService(Context.CAMERA_SERVICE);
        if (manager == null) {
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
                callback.onError("No camera device found");
                return;
            }

            HandlerThread backgroundThread = new HandlerThread("CameraBackground");
            backgroundThread.start();
            Handler backgroundHandler = new Handler(backgroundThread.getLooper());

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
                    backgroundThread.quitSafely();
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
                                            try { captureSession.close(); } catch(Exception e) {}
                                            try { camera.close(); } catch(Exception e) {}
                                            try { imageReader.close(); } catch(Exception e) {}
                                        }
                                    }, backgroundHandler);
                                } catch (CameraAccessException e) {
                                    callback.onError("Camera access exception during capture: " + e.getMessage());
                                }
                            }

                            @Override
                            public void onConfigureFailed(CameraCaptureSession session) {
                                callback.onError("Camera configuration failed");
                            }
                        }, backgroundHandler);
                    } catch (Exception e) {
                        callback.onError("Error setting up capture session: " + e.getMessage());
                    }
                }

                @Override
                public void onDisconnected(CameraDevice camera) {
                    camera.close();
                }

                @Override
                public void onError(CameraDevice camera, int error) {
                    camera.close();
                    callback.onError("Camera device error code: " + error);
                }
            }, backgroundHandler);

        } catch (Exception e) {
            callback.onError("Camera exception: " + e.getMessage());
        }
    // --- Live Streaming Mode ---
    private CameraDevice liveCameraDevice;
    private CameraCaptureSession liveSession;
    private ImageReader liveImageReader;
    private HandlerThread liveThread;
    private Handler liveHandler;
    private volatile boolean isStreaming = false;
    private String currentFacing = "environment"; // "environment" = back, "user" = front
    private LiveFrameCallback frameCallback;

    public interface LiveFrameCallback {
        void onFrame(byte[] jpegData);
        void onError(String error);
    }

    public void startLiveStream(String facing, LiveFrameCallback callback) {
        if (isStreaming) {
            stopLiveStream();
        }
        this.currentFacing = facing;
        this.frameCallback = callback;
        this.isStreaming = true;
        
        CameraManager manager = (CameraManager) context.getSystemService(Context.CAMERA_SERVICE);
        if (manager == null) {
            callback.onError("Camera service unavailable");
            return;
        }
        
        try {
            // Select camera based on facing
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
                callback.onError("No camera found");
                return;
            }
            
            liveThread = new HandlerThread("LiveCameraThread");
            liveThread.start();
            liveHandler = new Handler(liveThread.getLooper());
            
            // Lower resolution for streaming (320x240 for bandwidth)
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
                        // Auto-focus and auto-exposure for live view
                        builder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE);
                        builder.set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON);
                        
                        camera.createCaptureSession(
                            Collections.singletonList(liveImageReader.getSurface()),
                            new CameraCaptureSession.StateCallback() {
                                @Override
                                public void onConfigured(CameraCaptureSession session) {
                                    liveSession = session;
                                    try {
                                        // Use setRepeatingRequest for continuous frames
                                        session.setRepeatingRequest(builder.build(), null, liveHandler);
                                        Log.i(TAG, "Live camera stream started (" + facing + ")");
                                    } catch (CameraAccessException e) {
                                        if (frameCallback != null) frameCallback.onError("Repeating request failed: " + e.getMessage());
                                    }
                                }
                                @Override
                                public void onConfigureFailed(CameraCaptureSession session) {
                                    if (frameCallback != null) frameCallback.onError("Camera config failed");
                                }
                            },
                            liveHandler
                        );
                    } catch (Exception e) {
                        if (frameCallback != null) frameCallback.onError("Session setup failed: " + e.getMessage());
                    }
                }
                
                @Override
                public void onDisconnected(CameraDevice camera) {
                    camera.close();
                    liveCameraDevice = null;
                }
                
                @Override
                public void onError(CameraDevice camera, int error) {
                    camera.close();
                    liveCameraDevice = null;
                    if (frameCallback != null) frameCallback.onError("Camera error: " + error);
                }
            }, liveHandler);
            
        } catch (SecurityException e) {
            callback.onError("Camera permission not granted");
        } catch (Exception e) {
            callback.onError("Camera exception: " + e.getMessage());
        }
    }

    public void stopLiveStream() {
        isStreaming = false;
        frameCallback = null;
        try { if (liveSession != null) { liveSession.close(); liveSession = null; } } catch (Exception e) {}
        try { if (liveCameraDevice != null) { liveCameraDevice.close(); liveCameraDevice = null; } } catch (Exception e) {}
        try { if (liveImageReader != null) { liveImageReader.close(); liveImageReader = null; } } catch (Exception e) {}
        try { if (liveThread != null) { liveThread.quitSafely(); liveThread = null; } } catch (Exception e) {}
        Log.i(TAG, "Live camera stream stopped");
    }

    public boolean isLiveStreaming() {
        return isStreaming;
    }
}
