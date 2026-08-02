package com.freshdelivery.nativedriver.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = FreshGreen,
    onPrimary = Color.White,
    secondary = FreshGreenDark,
    background = FreshSurface,
    surface = Color.White,
    error = FreshError,
)

private val DarkColors = darkColorScheme(
    primary = FreshGreen,
    onPrimary = Color.Black,
    secondary = FreshGreenDark,
    background = FreshCharcoal,
    surface = FreshCharcoal,
    error = FreshError,
)

@Composable
fun FreshDriverTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = FreshTypography,
        content = content,
    )
}
