package com.staykids.parent.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val StayKidsColorScheme = darkColorScheme(
    background = DarkBackground,
    surface = DarkSurface,
    primary = PrimaryGreen,
    error = DangerRed,
    onBackground = TextPrimary,
    onSurface = TextPrimary,
    onPrimary = TextPrimary,
    surfaceVariant = SurfaceHighlight,
    onSurfaceVariant = TextSecondary
)

@Composable
fun StayKidsTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = StayKidsColorScheme,
        content = content
    )
}