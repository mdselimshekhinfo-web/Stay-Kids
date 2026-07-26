package com.staykids.parent;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

public class StayKidsScreenCaptureService extends Service {

    private static final String TAG = "StayKidsScreenCapture";
    private static final String CHANNEL_ID = "staykids_screen_stream";
    private static final int NOTIFICATION_ID = 8842;

    private static MediaProjection mediaProjection;
    private static VirtualDisplay virtualDisplay;
    private static ImageReader imageReader;
    private static StayKidsScreenCaptureService instance;
    private static FrameListener frameListener;

    private static final int WIDTH = 540;
    private static final int HEIGHT = 960;
    private static long lastFrameTime = 0;

    public interface FrameListener {
        void onFrameAvailable(String base64Jpeg);
    }

    public static void setFrameListener(FrameListener listener) {
        frameListener = listener;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            int resultCode = intent.getIntExtra("resultCode", -1);
            Intent data = intent.getParcelableExtra("data");
            if (resultCode != -1 && data != null) {
                Notification notification = buildNotification();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
                } else {
                    startForeground(NOTIFICATION_ID, notification);
                }

                MediaProjectionManager projectionManager = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
                if (projectionManager != null) {
                    mediaProjection = projectionManager.getMediaProjection(resultCode, data);
                    if (mediaProjection != null) {
                        startVirtualDisplay();
                        Log.i(TAG, "MediaProjection session & VirtualDisplay started successfully.");
                    }
                }
            }
        }
        return START_NOT_STICKY;
    }

    private int getBatteryLevel() {
        try {
            BatteryManager bm = (BatteryManager) getSystemService(Context.BATTERY_SERVICE);
            if (bm != null) {
                int level = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
                if (level > 0) return level;
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to read BatteryManager capacity: " + e.getMessage());
        }
        return 100;
    }

    private boolean isCharging() {
        try {
            Intent intent = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            if (intent != null) {
                int status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
                return status == BatteryManager.BATTERY_STATUS_CHARGING ||
                       status == BatteryManager.BATTERY_STATUS_FULL;
            }
        } catch (Exception _e) {}
        return false;
    }

    private void startVirtualDisplay() {
        if (mediaProjection == null) return;
        try {
            imageReader = ImageReader.newInstance(WIDTH, HEIGHT, PixelFormat.RGBA_8888, 2);
            virtualDisplay = mediaProjection.createVirtualDisplay(
                "StayKidsScreenCapture",
                WIDTH,
                HEIGHT,
                1, // Density DPI
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader.getSurface(),
                null,
                null
            );

            imageReader.setOnImageAvailableListener(new ImageReader.OnImageAvailableListener() {
                @Override
                public void onImageAvailable(ImageReader reader) {
                    long now = System.currentTimeMillis();

                    // Battery-aware dynamic frame rate & JPEG quality throttling
                    int batteryLevel = getBatteryLevel();
                    boolean charging = isCharging();

                    long minInterval = 100; // Normal ~10 fps
                    int jpegQuality = 55;   // Normal JPEG quality

                    if (batteryLevel <= 20 && !charging) {
                        minInterval = 200; // Low battery -> ~5 fps
                        jpegQuality = 35;   // Low battery -> 35% JPEG quality to save CPU & radio power
                    } else if (batteryLevel <= 10 && !charging) {
                        minInterval = 333; // Critical battery -> ~3 fps
                        jpegQuality = 25;
                    }

                    if (now - lastFrameTime < minInterval) {
                        Image image = reader.acquireNextImage();
                        if (image != null) image.close();
                        return;
                    }
                    lastFrameTime = now;

                    Image image = null;
                    try {
                        image = reader.acquireLatestImage();
                        if (image != null) {
                            Image.Plane[] planes = image.getPlanes();
                            ByteBuffer buffer = planes[0].getBuffer();
                            int pixelStride = planes[0].getPixelStride();
                            int rowStride = planes[0].getRowStride();
                            int rowPadding = rowStride - pixelStride * WIDTH;

                            Bitmap bitmap = Bitmap.createBitmap(WIDTH + rowPadding / pixelStride, HEIGHT, Bitmap.Config.ARGB_8888);
                            bitmap.copyPixelsFromBuffer(buffer);

                            ByteArrayOutputStream baos = new ByteArrayOutputStream();
                            bitmap.compress(Bitmap.CompressFormat.JPEG, jpegQuality, baos);
                            byte[] jpegData = baos.toByteArray();
                            bitmap.recycle();

                            String base64 = "data:image/jpeg;base64," + Base64.encodeToString(jpegData, Base64.NO_WRAP);
                            if (frameListener != null) {
                                new Handler(Looper.getMainLooper()).post(() -> {
                                    if (frameListener != null) {
                                        frameListener.onFrameAvailable(base64);
                                    }
                                });
                            }
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error capturing screen frame: " + e.getMessage());
                    } finally {
                        if (image != null) image.close();
                    }
                }
            }, new Handler(Looper.getMainLooper()));
        } catch (Exception e) {
            Log.e(TAG, "Failed to create VirtualDisplay: " + e.getMessage());
        }
    }

    public static MediaProjection getMediaProjection() {
        return mediaProjection;
    }

    public static boolean isStreaming() {
        return virtualDisplay != null || mediaProjection != null;
    }

    public static void stopScreenCapture() {
        stopScreenShare();
    }

    public static void stopScreenShare() {
        try {
            if (virtualDisplay != null) {
                virtualDisplay.release();
                virtualDisplay = null;
            }
            if (imageReader != null) {
                imageReader.close();
                imageReader = null;
            }
            if (mediaProjection != null) {
                mediaProjection.stop();
                mediaProjection = null;
            }
            if (instance != null) {
                instance.stopForeground(true);
                instance.stopSelf();
            }
            Log.i(TAG, "StayKidsScreenCaptureService stopped and resources released.");
        } catch (Exception e) {
            Log.e(TAG, "Error stopping MediaProjection service: " + e.getMessage());
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopScreenShare();
        super.onDestroy();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "StayKids Screen Stream",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Protects child device with active screen sharing oversight.");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification() {
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        return builder
            .setContentTitle("StayKids Protection Active")
            .setContentText("Screen stream connected safely via WebRTC")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setOngoing(true)
            .build();
    }
}
