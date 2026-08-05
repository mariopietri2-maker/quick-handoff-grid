package com.freshdelivery.nativedriver.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/** Uber Eats-style light-first scheme: white surfaces, green primary, near-black text. */
private val LightColors = lightColorScheme(
    primary = FreshGreen,
    onPrimary = Color.White,
    primaryContainer = FreshGreenSoft,
    onPrimaryContainer = FreshGreenDeep,
    inversePrimary = FreshGreen,
    secondary = FreshBlack,
    onSecondary = Color.White,
    tertiary = FreshAmberDeep,
    background = FreshBackground,
    onBackground = FreshBlack,
    surface = FreshSurface,
    onSurface = FreshBlack,
    surfaceVariant = FreshSurfaceAlt,
    onSurfaceVariant = FreshTextMuted,
    surfaceContainer = FreshSurface,
    surfaceContainerHigh = FreshSurface,
    surfaceContainerHighest = FreshSurfaceAlt,
    inverseSurface = FreshCharcoal,
    inverseOnSurface = Color.White,
    outline = FreshOutline,
    outlineVariant = FreshOutline,
    error = FreshError,
    onError = Color.White,
    errorContainer = Color(0xFFFDECEA),
    onErrorContainer = Color(0xFF8C1D18),
    scrim = Color(0x66000000),
)

private val DarkColors = darkColorScheme(
    primary = FreshGreen,
    onPrimary = Color.Black,
    primaryContainer = Color(0xFF0D3D28),
    onPrimaryContainer = FreshGreen,
    secondary = Color.White,
    onSecondary = Color.Black,
    tertiary = FreshAmber,
    background = FreshCharcoalDark,
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

private val UberEatsShapes = Shapes(
    extraSmall = RoundedCornerShape(10.dp),
    small = RoundedCornerShape(14.dp),
    medium = RoundedCornerShape(18.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(30.dp),
)

@Composable
fun FreshDriverTheme(
    darkTheme: Boolean = false, // Uber Eats-style: light-first by default
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = FreshTypography,
        shapes = UberEatsShapes,
        content = content,
    )
}
