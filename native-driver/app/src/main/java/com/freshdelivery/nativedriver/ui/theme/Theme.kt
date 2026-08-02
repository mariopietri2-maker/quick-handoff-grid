package com.freshdelivery.nativedriver.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

private val DarkColors = darkColorScheme(
    primary = FreshGreen,
    onPrimary = Color.Black,
    primaryContainer = FreshGreenSoft,
    onPrimaryContainer = FreshGreen,
    secondary = FreshBlue,
    onSecondary = Color.White,
    tertiary = FreshAmber,
    background = FreshCharcoal,
    onBackground = Color(0xFFF1F5F9),
    surface = FreshSurfaceDark,
    onSurface = Color(0xFFF1F5F9),
    surfaceVariant = FreshCardDark,
    onSurfaceVariant = FreshMuted,
    outline = Color(0xFF2A3544),
    error = FreshError,
    onError = Color.White,
    errorContainer = Color(0xFF3D1520),
    onErrorContainer = Color(0xFFFFB4C0),
)

private val LightColors = lightColorScheme(
    primary = FreshGreenDark,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD4F5E4),
    onPrimaryContainer = FreshGreenDark,
    secondary = FreshBlue,
    background = FreshSurface,
    onBackground = Color(0xFF0B0F14),
    surface = FreshCardLight,
    onSurface = Color(0xFF0B0F14),
    surfaceVariant = Color(0xFFEEF1F5),
    onSurfaceVariant = Color(0xFF5A6472),
    outline = Color(0xFFE2E8F0),
    error = FreshError,
)

private val FreshShapes = Shapes(
    extraSmall = RoundedCornerShape(10.dp),
    small = RoundedCornerShape(14.dp),
    medium = RoundedCornerShape(20.dp),
    large = RoundedCornerShape(28.dp),
    extraLarge = RoundedCornerShape(36.dp),
)

@Composable
fun FreshDriverTheme(
    darkTheme: Boolean = true, // driver app is dark-first (shift / night use)
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = FreshTypography,
        shapes = FreshShapes,
        content = content,
    )
}
