package com.staykids.parent.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.staykids.parent.ui.theme.*

@Composable
fun DashboardScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(16.dp)
    ) {
        Text("Child Dashboard", color = PrimaryGreen, style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(16.dp))
        Card(colors = CardDefaults.cardColors(containerColor = DarkSurface), modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Remote Control", color = TextPrimary)
                Spacer(modifier = Modifier.height(8.dp))
                Button(onClick = { }, colors = ButtonDefaults.buttonColors(containerColor = PrimaryGreen)) {
                    Text("Start Screen Mirroring")
                }
            }
        }
    }
}