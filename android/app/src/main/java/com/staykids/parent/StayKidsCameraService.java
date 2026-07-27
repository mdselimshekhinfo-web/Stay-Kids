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
    }
}
