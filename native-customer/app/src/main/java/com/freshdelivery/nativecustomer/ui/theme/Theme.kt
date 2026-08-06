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

/** Modern fresh palette — airy surfaces, emerald primary, violet accent. */
val FreshGreen = Color(0xFF10B981)
val FreshGreenDark = Color(0xFF0E9F6E)
val FreshGreenSoft = Color(0xFFDCFCE7)
val FreshViolet = Color(0xFF7C6CFF)
val FreshVioletSoft = Color(0xFFEFEBFF)
val FreshAmber = Color(0xFFF59E0B)
val FreshAmberSoft = Color(0xFFFFF4E5)
val FreshRose = Color(0xFFF43F5E)
val FreshRoseSoft = Color(0xFFFFE9EC)
val FreshInk = Color(0xFF151821)
val FreshMuted = Color(0xFF6E7482)
val FreshBg = Color(0xFFF6F7F9)
val FreshSurface = Color(0xFFFFFFFF)
val FreshChip = Color(0xFFEDF0F4)
val FreshDivider = Color(0xFFE9EBF0)

private val FreshColors = lightColorScheme(
    primary = FreshGreen,
    onPrimary = Color.White,
    primaryContainer = FreshGreenSoft,
    onPrimaryContainer = FreshGreenDark,
    secondary = FreshViolet,
    onSecondary = Color.White,
    secondaryContainer = FreshVioletSoft,
    onSecondaryContainer = FreshViolet,
    background = FreshBg,
    surface = FreshSurface,
    surfaceVariant = FreshChip,
    onBackground = FreshInk,
    onSurface = FreshInk,
    onSurfaceVariant = FreshMuted,
    outline = FreshDivider,
    error = FreshRose,
    onError = Color.White,
)

private val FreshType = Typography(
    displaySmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 30.sp,
        letterSpacing = (-0.5).sp,
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
        letterSpacing = (-0.2).sp,
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
        color = FreshMuted,
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

private val FreshShapes = Shapes(
    extraSmall = RoundedCornerShape(12.dp),
    small = RoundedCornerShape(14.dp),
    medium = RoundedCornerShape(18.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(32.dp),
)

@Composable
fun FreshCustomerTheme(
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = FreshColors,
        typography = FreshType,
        shapes = FreshShapes,
        content = content,
    )
}
