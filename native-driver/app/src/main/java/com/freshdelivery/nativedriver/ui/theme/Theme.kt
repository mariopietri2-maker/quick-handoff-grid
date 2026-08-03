package com.freshdelivery.nativedriver.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/** Uber Driver–style: black surfaces, white text, green primary. Name: Fresh Delivery. */
private val DarkColors = darkColorScheme(
    primary = FreshGreen,
    onPrimary = Color.Black,
    primaryContainer = FreshGreenSoft,
    onPrimaryContainer = FreshGreen,
    secondary = Color.White,
    onSecondary = Color.Black,
    tertiary = FreshAmber,
    background = FreshCharcoal,
    onBackground = Color.White,
    surface = FreshSurfaceDark,
    onSurface = Color.White,
    surfaceVariant = FreshCardDark,
    onSurfaceVariant = FreshMuted,
    outline = Color(0xFF333333),
    error = FreshError,
    onError = Color.White,
    errorContainer = Color(0xFF3D1520),
    onErrorContainer = Color(0xFFFFB4C0),
)

private val LightColors = lightColorScheme(
    primary = FreshGreen,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD4F7E5),
    onPrimaryContainer = FreshGreenDark,
    secondary = Color(0xFF141414),
    background = Color.White,
    onBackground = Color(0xFF141414),
    surface = Color.White,
    onSurface = Color(0xFF141414),
    surfaceVariant = Color(0xFFF6F6F6),
    onSurfaceVariant = Color(0xFF6B6B6B),
    outline = Color(0xFFE8E8E8),
    error = FreshError,
)

private val UberShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(32.dp),
)

@Composable
fun FreshDriverTheme(
    darkTheme: Boolean = true, // driver app is dark-first (shift / night)
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = FreshTypography,
        shapes = UberShapes,
        content = content,
    )
}
