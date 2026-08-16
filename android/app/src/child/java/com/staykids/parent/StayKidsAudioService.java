package com.staykids.parent;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Process;
import android.util.Base64;
import android.util.Log;
import java.io.ByteArrayOutputStream;

public class StayKidsAudioService extends Service {

    private static final String TAG = "StayKidsAudioService";
    private static final String CHANNEL_ID = "staykids_audio_stream";
    private static final int NOTIFICATION_ID = 8843;
    private static final long MAX_STREAM_DURATION_MS = 10 * 60 * 1000L; // 10 minutes max safety limit
    private static final long LOW_BATTERY_STREAM_DURATION_MS = 2 * 60 * 1000L; // 2 minutes cap on low battery

    private static StayKidsAudioService instance;
    private static AudioChunkListener chunkListener;
    private static volatile boolean isRecording = false;
    private static volatile AudioRecord activeAudioRecord;
    private Thread recordingThread;

    private final Handler autoStopHandler = new Handler(Looper.getMainLooper());
    private final Runnable autoStopRunnable = () -> {
        if (isRecording) {
            Log.w(TAG, "Audio recording reached maximum safety duration limit. Automatically stopping.");
            stopAudioCapture();
        }
    };

    private static final int SAMPLE_RATE = 16000;
    private static final int CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO;
    private static final int AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT;

    public interface AudioChunkListener {
        void onAudioChunkAvailable(String base64Wav);
    }

    public static void setAudioChunkListener(AudioChunkListener listener) {
        chunkListener = listener;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        startRecording();
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
            Log.e(TAG, "Failed to read battery level: " + e.getMessage());
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

    private void startRecording() {
        if (isRecording) return;

        // 3. Battery Awareness Logic
        int batteryLevel = getBatteryLevel();
        boolean charging = isCharging();

        if (batteryLevel <= 5 && !charging) {
            Log.w(TAG, "Battery level critical (" + batteryLevel + "%). Ambient audio capture declined to preserve battery.");
            stopSelf();
            return;
        }

        long sessionMaxDuration = (batteryLevel <= 15 && !charging)
            ? LOW_BATTERY_STREAM_DURATION_MS
            : MAX_STREAM_DURATION_MS;

        if (batteryLevel <= 15 && !charging) {
            Log.w(TAG, "Battery level low (" + batteryLevel + "%). Capping audio capture session to 2 minutes.");
        }

        isRecording = true;

        // 2. Schedule Max-Duration Safety Auto-Stop Timer
        autoStopHandler.removeCallbacks(autoStopRunnable);
        autoStopHandler.postDelayed(autoStopRunnable, sessionMaxDuration);

        recordingThread = new Thread(() -> {
            // 4. Elevate Thread Priority for Urgent Audio Processing
            try {
                Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO);
            } catch (Exception _e) {}

            int minBufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT);
            if (minBufferSize <= 0) {
                Log.e(TAG, "Invalid buffer size: " + minBufferSize);
                isRecording = false;
                return;
            }
            int bufferSize = Math.max(minBufferSize, SAMPLE_RATE * 2 * 2); // ~2 second buffer

            try {
                activeAudioRecord = new AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    SAMPLE_RATE,
                    CHANNEL_CONFIG,
                    AUDIO_FORMAT,
                    bufferSize
                );

                if (activeAudioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                    Log.e(TAG, "AudioRecord initialization failed.");
                    isRecording = false;
                    return;
                }

                activeAudioRecord.startRecording();
                Log.i(TAG, "StayKids Ambient Audio Recording started successfully.");

                byte[] buffer = new byte[bufferSize];

                while (isRecording) {
                    int read = activeAudioRecord.read(buffer, 0, buffer.length);
                    if (read > 0) {
                        byte[] wavHeader = createWavHeader(read, SAMPLE_RATE, 1, 16);
                        ByteArrayOutputStream baos = new ByteArrayOutputStream();
                        baos.write(wavHeader);
                        baos.write(buffer, 0, read);
                        byte[] wavData = baos.toByteArray();

                        String base64Wav = "data:audio/wav;base64," + Base64.encodeToString(wavData, Base64.NO_WRAP);

                        if (chunkListener != null) {
                            new Handler(Looper.getMainLooper()).post(() -> {
                                if (chunkListener != null) {
                                    chunkListener.onAudioChunkAvailable(base64Wav);
                                }
                            });
                        }
                    }
                }

                if (activeAudioRecord != null) {
                    try { activeAudioRecord.stop(); } catch (Exception _e) {}
                    try { activeAudioRecord.release(); } catch (Exception _e) {}
                }
            } catch (Exception e) {
                Log.e(TAG, "Error during ambient audio capture: " + e.getMessage());
                if (activeAudioRecord != null) {
                    try { activeAudioRecord.release(); } catch (Exception _e) {}
                }
            } finally {
                activeAudioRecord = null;
            }
        });

        recordingThread.start();
    }

    public static boolean isAudioCapturing() {
        return isRecording;
    }

    public static void stopAudioCapture() {
        isRecording = false;
        if (instance != null) {
            instance.autoStopHandler.removeCallbacks(instance.autoStopRunnable);

            if (instance.recordingThread != null) {
                try {
                    instance.recordingThread.join(2000);
                } catch (InterruptedException e) {
                    Log.e(TAG, "Thread join interrupted", e);
                }

                // 1. Force-stop AudioRecord & thread if thread did not terminate within join timeout
                if (instance.recordingThread != null && instance.recordingThread.isAlive()) {
                    Log.w(TAG, "Recording thread did not exit within 2000ms join timeout. Force stopping AudioRecord.");
                    try {
                        if (activeAudioRecord != null) {
                            activeAudioRecord.stop();
                            activeAudioRecord.release();
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error force stopping AudioRecord: " + e.getMessage());
                    }
                    try {
                        instance.recordingThread.interrupt();
                    } catch (Exception _e) {}
                }
                instance.recordingThread = null;
            }

            activeAudioRecord = null;
            instance.stopForeground(true);
            instance.stopSelf();
        }
    }

    private byte[] createWavHeader(int pcmLen, int sampleRate, int channels, int bitsPerSample) {
        int totalDataLen = pcmLen + 36;
        int byteRate = sampleRate * channels * bitsPerSample / 8;
        byte[] header = new byte[44];

        header[0] = 'R'; header[1] = 'I'; header[2] = 'F'; header[3] = 'F';
        header[4] = (byte) (totalDataLen & 0xff);
        header[5] = (byte) ((totalDataLen >> 8) & 0xff);
        header[6] = (byte) ((totalDataLen >> 16) & 0xff);
        header[7] = (byte) ((totalDataLen >> 24) & 0xff);
        header[8] = 'W'; header[9] = 'A'; header[10] = 'V'; header[11] = 'E';
        header[12] = 'f'; header[13] = 'm'; header[14] = 't'; header[15] = ' ';
        header[16] = 16; header[17] = 0; header[18] = 0; header[19] = 0; // Subchunk1Size (16 for PCM)
        header[20] = 1; header[21] = 0; // AudioFormat (1 for PCM)
        header[22] = (byte) channels; header[23] = 0;
        header[24] = (byte) (sampleRate & 0xff);
        header[25] = (byte) ((sampleRate >> 8) & 0xff);
        header[26] = (byte) ((sampleRate >> 16) & 0xff);
        header[27] = (byte) ((sampleRate >> 24) & 0xff);
        header[28] = (byte) (byteRate & 0xff);
        header[29] = (byte) ((byteRate >> 8) & 0xff);
        header[30] = (byte) ((byteRate >> 16) & 0xff);
        header[31] = (byte) ((byteRate >> 24) & 0xff);
        header[32] = (byte) (channels * bitsPerSample / 8); header[33] = 0; // BlockAlign
        header[34] = (byte) bitsPerSample; header[35] = 0;
        header[36] = 'd'; header[37] = 'a'; header[38] = 't'; header[39] = 'a';
        header[40] = (byte) (pcmLen & 0xff);
        header[41] = (byte) ((pcmLen >> 8) & 0xff);
        header[42] = (byte) ((pcmLen >> 16) & 0xff);
        header[43] = (byte) ((pcmLen >> 24) & 0xff);

        return header;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopAudioCapture();
        super.onDestroy();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "StayKids Audio Stream",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Protects child device with active audio monitoring.");
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
            .setContentText("Ambient audio monitoring active")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .build();
    }
}
