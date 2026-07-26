package com.staykids.parent;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import java.io.ByteArrayOutputStream;

public class StayKidsAudioService extends Service {

    private static final String TAG = "StayKidsAudioService";
    private static final String CHANNEL_ID = "staykids_audio_stream";
    private static final int NOTIFICATION_ID = 8843;

    private static StayKidsAudioService instance;
    private static AudioChunkListener chunkListener;
    private static boolean isRecording = false;
    private Thread recordingThread;

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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        startRecording();
        return START_NOT_STICKY;
    }

    private void startRecording() {
        if (isRecording) return;
        isRecording = true;

        recordingThread = new Thread(() -> {
            int minBufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT);
            int bufferSize = Math.max(minBufferSize, SAMPLE_RATE * 2 * 2); // ~2 second buffer

            AudioRecord audioRecord = null;
            try {
                audioRecord = new AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    SAMPLE_RATE,
                    CHANNEL_CONFIG,
                    AUDIO_FORMAT,
                    bufferSize
                );

                if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                    Log.e(TAG, "AudioRecord initialization failed.");
                    isRecording = false;
                    return;
                }

                audioRecord.startRecording();
                Log.i(TAG, "StayKids Ambient Audio Recording started successfully.");

                byte[] buffer = new byte[bufferSize];

                while (isRecording) {
                    int read = audioRecord.read(buffer, 0, buffer.length);
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
                    Thread.sleep(1500); // Send ~2 second ambient audio chunks
                }

                audioRecord.stop();
                audioRecord.release();
            } catch (Exception e) {
                Log.e(TAG, "Error during ambient audio capture: " + e.getMessage());
                if (audioRecord != null) {
                    try { audioRecord.release(); } catch (Exception _e) {}
                }
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
        header[32] = (byte) (channels * bitsPerSample / 8); header[33] = 0;
        header[34] = (byte) bitsPerSample; header[35] = 0;
        header[36] = 'd'; header[37] = 'a'; header[38] = 't'; header[39] = 'a';
        header[40] = (byte) (pcmLen & 0xff);
        header[41] = (byte) ((pcmLen >> 8) & 0xff);
        header[42] = (byte) ((pcmLen >> 16) & 0xff);
        header[43] = (byte) ((pcmLen >> 24) & 0xff);

        return header;
    }

    private Notification buildNotification() {
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        return builder
            .setContentTitle("StayKids Audio Stream Active")
            .setContentText("Ambient surroundings audio monitoring is active for child protection.")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "StayKids Ambient Audio Stream Notification",
                NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        stopAudioCapture();
        instance = null;
    }
}
