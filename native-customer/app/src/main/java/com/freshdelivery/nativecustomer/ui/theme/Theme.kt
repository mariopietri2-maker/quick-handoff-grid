package com.freshdelivery.nativecustomer.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Uber Eats–inspired palette (always light). */
val UberGreen = Color(0xFF06C167)
val UberGreenDark = Color(0xFF05A357)
val UberBlack = Color(0xFF000000)
val UberInk = Color(0xFF141414)
val UberMuted = Color(0xFF6B6B6B)
val UberBg = Color(0xFFFFFFFF)
val UberSurface = Color(0xFFF6F6F6)
val UberChip = Color(0xFFEEEEEE)
val UberDivider = Color(0xFFE8E8E8)

private val UberColors = lightColorScheme(
    primary = UberGreen,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD4F7E5),
    onPrimaryContainer = UberGreenDark,
    secondary = UberInk,
    onSecondary = Color.White,
    background = UberBg,
    surface = UberBg,
    surfaceVariant = UberSurface,
    onBackground = UberInk,
    onSurface = UberInk,
    onSurfaceVariant = UberMuted,
    outline = UberDivider,
    error = Color(0xFFE11900),
    onError = Color.White,
)

private val UberType = Typography(
    displaySmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 28.sp,
        letterSpacing = (-0.4).sp,
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 24.sp,
        letterSpacing = (-0.3).sp,
    ),
    headlineSmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 20.sp,
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 18.sp,
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 16.sp,
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
    ),
    bodySmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        color = UberMuted,
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 14.sp,
    ),
    labelMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
    ),
)

private val UberShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(28.dp),
)

@Composable
fun FreshCustomerTheme(
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = UberColors,
        typography = UberType,
        shapes = UberShapes,
        content = content,
    )
}
