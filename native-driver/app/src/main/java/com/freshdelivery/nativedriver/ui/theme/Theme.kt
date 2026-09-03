package com.freshdelivery.nativedriver.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/** Dark scheme kept for optional night mode. */
private val DarkColors = darkColorScheme(
    primary = FreshGreenBright,
    onPrimary = FreshCharcoal,
    primaryContainer = FreshGreenSoft,
    onPrimaryContainer = FreshGreenGlow,
    inversePrimary = FreshGreen,
    secondary = FreshBlack,
    onSecondary = FreshCharcoal,
    tertiary = FreshAmber,
    onTertiary = FreshCharcoal,
    background = FreshBackground,
    onBackground = FreshBlack,
    surface = FreshSurface,
    onSurface = FreshBlack,
    surfaceVariant = FreshSurfaceAlt,
    onSurfaceVariant = FreshTextMuted,
    surfaceContainer = FreshSurface,
    surfaceContainerHigh = FreshSurfaceHigh,
    surfaceContainerHighest = FreshSurfaceAlt,
    inverseSurface = Color.White,
    inverseOnSurface = FreshCharcoal,
    outline = FreshOutline,
    outlineVariant = Color(0xFF2A322C),
    error = FreshError,
    onError = FreshCharcoal,
    errorContainer = FreshErrorContainer,
    onErrorContainer = Color(0xFFFFB4B9),
    scrim = Color(0xCC000000),
)

/** Light-first (efood-style): #F7F7F8 page, white cards, green primary. */
private val LightColors = lightColorScheme(
    primary = FreshGreen,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE6F9F0),
    onPrimaryContainer = FreshGreenDeep,
    secondary = FreshCharcoal,
    onSecondary = Color.White,
    tertiary = FreshAmberDeep,
    background = LightBg,
    onBackground = LightText,
    surface = LightSurface,
    onSurface = LightText,
    surfaceVariant = LightSurfaceAlt,
    onSurfaceVariant = LightTextMuted,
    surfaceContainer = LightSurface,
    surfaceContainerHigh = LightSurface,
    surfaceContainerHighest = LightSurfaceAlt,
    inverseSurface = FreshCharcoal,
    inverseOnSurface = Color.White,
    outline = LightOutline,
    outlineVariant = LightOutline,
    error = Color(0xFFD93025),
    onError = Color.White,
    errorContainer = Color(0xFFFDECEA),
    onErrorContainer = Color(0xFF8C1D18),
    scrim = Color(0x66000000),
)

private val FreshShapes = Shapes(
    extraSmall = RoundedCornerShape(10.dp),
    small = RoundedCornerShape(14.dp),
    medium = RoundedCornerShape(18.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(30.dp),
)

@Composable
fun FreshDriverTheme(
    darkTheme: Boolean = false, // Light-first (efood-style); pass true for dark
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = FreshTypography,
        shapes = FreshShapes,
        content = content,
    )
}
