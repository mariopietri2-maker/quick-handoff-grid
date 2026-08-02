package com.freshdelivery.nativecustomer.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Brand = Color(0xFF00C853)
private val BrandDark = Color(0xFF00A844)
private val Ink = Color(0xFF0B0F14)
private val SoftBg = Color(0xFFF3F5F7)
private val Card = Color(0xFFFFFFFF)
private val Muted = Color(0xFF6B7280)

private val DarkColors = darkColorScheme(
    primary = Brand,
    onPrimary = Color.Black,
    background = Color(0xFF0B0F14),
    surface = Color(0xFF141A22),
    surfaceVariant = Color(0xFF1C2430),
    onBackground = Color(0xFFF8FAFC),
    onSurface = Color(0xFFF8FAFC),
    onSurfaceVariant = Color(0xFF9CA3AF),
    outline = Color(0xFF2A3544),
    error = Color(0xFFFF3B5C),
)

private val LightColors = lightColorScheme(
    primary = BrandDark,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD4F5E4),
    onPrimaryContainer = BrandDark,
    background = SoftBg,
    surface = Card,
    surfaceVariant = Color(0xFFEEF1F5),
    onBackground = Ink,
    onSurface = Ink,
    onSurfaceVariant = Muted,
    outline = Color(0xFFE5E7EB),
    error = Color(0xFFFF3B5C),
)

private val PremiumType = Typography(
    displaySmall = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 30.sp, letterSpacing = (-0.5).sp),
    headlineMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 22.sp),
    titleLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 20.sp),
    titleMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 16.sp),
    bodyLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Normal, fontSize = 16.sp),
    bodyMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Normal, fontSize = 14.sp),
    bodySmall = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Normal, fontSize = 12.sp),
    labelLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 14.sp),
)

private val PremiumShapes = Shapes(
    extraSmall = RoundedCornerShape(10.dp),
    small = RoundedCornerShape(14.dp),
    medium = RoundedCornerShape(20.dp),
    large = RoundedCornerShape(28.dp),
    extraLarge = RoundedCornerShape(36.dp),
)

@Composable
fun FreshCustomerTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = PremiumType,
        shapes = PremiumShapes,
        content = content,
    )
}
