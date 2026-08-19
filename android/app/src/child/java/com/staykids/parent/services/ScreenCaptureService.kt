package com.staykids.parent.services

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.staykids.parent.data.WebRtcManager
import org.webrtc.*

class ScreenCaptureService : Service() {
    private var mediaProjection: MediaProjection? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null
    private var videoCapturer: VideoCapturer? = null
    private var webRtcManager: WebRtcManager? = null

    companion object {
        private const val CHANNEL_ID = "ScreenCaptureChannel"
        private const val NOTIFICATION_ID = 101
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val resultCode = intent?.getIntExtra("resultCode", -1) ?: -1
        val data = intent?.getParcelableExtra<Intent>("data")

        if (resultCode != -1 && data != null) {
            val notification = createNotification()
            startForeground(NOTIFICATION_ID, notification)

            val projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            mediaProjection = projectionManager.getMediaProjection(resultCode, data)
            
            setupWebRtcAndCapture(intent)
        }

        return START_NOT_STICKY
    }

    private fun setupWebRtcAndCapture(intent: Intent?) {
        webRtcManager = WebRtcManager(this)
        webRtcManager?.createPeerConnection()

        val eglBaseContext = webRtcManager?.eglBaseContext ?: return
        
        // Use the 'data' intent that was passed in from the activity's result
        val dataIntent = intent?.getParcelableExtra<Intent>("data")
        if (dataIntent != null) {
            videoCapturer = ScreenCapturerAndroid(
                dataIntent, object : MediaProjection.Callback() {
                    override fun onStop() {
                        stopSelf()
                    }
                }
            )
        }

        if (videoCapturer == null) return

        surfaceTextureHelper = SurfaceTextureHelper.create("ScreenCaptureThread", eglBaseContext)
        val videoSource = webRtcManager?.peerConnectionFactory?.createVideoSource(videoCapturer!!.isScreencast)
        
        videoCapturer?.initialize(surfaceTextureHelper, this, videoSource?.capturerObserver)
        videoCapturer?.startCapture(1280, 720, 30)

        val videoTrack = webRtcManager?.peerConnectionFactory?.createVideoTrack("100", videoSource)
        if (videoTrack != null) {
            webRtcManager?.addVideoTrack(videoTrack)
        }
        
        // Setup signaling here (e.g. Supabase real-time) to exchange SDP and ICE candidates
        // For example: webRtcManager?.createOffer { ... }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Screen Capture Service",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Screen Mirroring")
            .setContentText("Your screen is being mirrored to the parent device.")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        super.onDestroy()
        videoCapturer?.stopCapture()
        videoCapturer?.dispose()
        surfaceTextureHelper?.dispose()
        webRtcManager?.release()
        mediaProjection?.stop()
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }
}
