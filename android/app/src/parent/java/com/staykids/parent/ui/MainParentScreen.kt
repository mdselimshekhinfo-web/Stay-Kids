package com.staykids.parent.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.staykids.parent.ui.theme.*
import com.staykids.parent.data.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainParentScreen() {
    var selectedTab by remember { mutableStateOf(0) }
    var appState by remember { mutableStateOf<StayKidsState?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        try {
            appState = SupabaseClient.getStayKidsState()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    Scaffold(
        bottomBar = {
            NavigationBar(containerColor = DarkSurface) {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Text("🏠") },
                    label = { Text("Dashboard", color = if (selectedTab == 0) PrimaryGreen else TextSecondary) },
                    colors = NavigationBarItemDefaults.colors(indicatorColor = SurfaceHighlight)
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Text("⚙️") },
                    label = { Text("Controls", color = if (selectedTab == 1) PrimaryGreen else TextSecondary) },
                    colors = NavigationBarItemDefaults.colors(indicatorColor = SurfaceHighlight)
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Text("🔔") },
                    label = { Text("Alerts", color = if (selectedTab == 2) PrimaryGreen else TextSecondary) },
                    colors = NavigationBarItemDefaults.colors(indicatorColor = SurfaceHighlight)
                )
            }
        }
    ) { innerPadding ->
        Surface(modifier = Modifier.padding(innerPadding), color = DarkBackground) {
            if (appState == null) {
                CircularProgressIndicator(color = PrimaryGreen)
            } else {
                when (selectedTab) {
                    0 -> DashboardScreen()
                    1 -> ControlsScreen(state = appState!!) { action -> 
                        scope.launch { SupabaseClient.sendStayKidsAction(action) }
                    }
                    2 -> AlertsScreen(state = appState!!) { action -> 
                        scope.launch { SupabaseClient.sendStayKidsAction(action) }
                    }
                }
            }
        }
    }
}