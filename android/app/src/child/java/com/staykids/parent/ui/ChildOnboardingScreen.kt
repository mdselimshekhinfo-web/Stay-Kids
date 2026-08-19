package com.staykids.parent.ui

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.staykids.parent.StayKidsDeviceAdminReceiver
import com.staykids.parent.ui.theme.*

@Composable
fun ChildOnboardingScreen(onPermissionsGranted: () -> Unit) {
    var step by remember { mutableStateOf(1) }
    val context = LocalContext.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "Setup StayKids",
            color = TextPrimary,
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(bottom = 32.dp)
        )

        Card(
            colors = CardDefaults.cardColors(containerColor = DarkSurface),
            modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                val title = when (step) {
                    1 -> "Usage Access"
                    2 -> "Accessibility"
                    3 -> "Device Admin"
                    else -> "Complete"
                }
                
                val desc = when (step) {
                    1 -> "Needed to monitor screen time and app usage."
                    2 -> "Needed to block apps and filter web content."
                    3 -> "Prevents the app from being uninstalled."
                    else -> "All permissions granted!"
                }

                Text(
                    text = title,
                    color = PrimaryGreen,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(bottom = 12.dp)
                )
                
                Text(
                    text = desc,
                    color = TextSecondary,
                    fontSize = 16.sp,
                    modifier = Modifier.padding(bottom = 24.dp)
                )

                Button(
                    onClick = {
                        when (step) {
                            1 -> {
                                val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
                                    data = Uri.parse("package:${context.packageName}")
                                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                                }
                                try { context.startActivity(intent) } catch (e: Exception) {
                                    val fallback = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
                                    fallback.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                                    try { context.startActivity(fallback) } catch (e: Exception) {}
                                }
                                step++
                            }
                            2 -> {
                                val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                                try { context.startActivity(intent) } catch (e: Exception) {}
                                step++
                            }
                            3 -> {
                                val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                                    putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, ComponentName(context, StayKidsDeviceAdminReceiver::class.java))
                                    putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "StayKids needs Device Admin to prevent unauthorized uninstallation.")
                                }
                                try { context.startActivity(intent) } catch (e: Exception) {}
                                step++
                            }
                            else -> {
                                onPermissionsGranted()
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryGreen),
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(if (step <= 3) "Grant Permission" else "Finish", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

