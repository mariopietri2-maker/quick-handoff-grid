package com.freshdelivery.nativecustomer.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Fresh2GO orange brand — matches web themeColor #EA580C. */
val FreshGreen = Color(0xFFEA580C)      // primary orange
val FreshGreenDark = Color(0xFFC2410C)  // deep orange
val FreshGreenSoft = Color(0xFFFFEDD5)  // soft peach chip
val FreshTeal = Color(0xFFF97316)       // bright brand orange
val FreshTealDark = Color(0xFFEA580C)
val FreshTealSoft = Color(0xFFFFF7ED)
val FreshGold = Color(0xFFFBBF24)
val FreshViolet = Color(0xFFFB7185)     // soft pink accent in gradient
val FreshVioletSoft = Color(0xFFFFE4E6)
val FreshAmber = Color(0xFFF59E0B)
val FreshAmberSoft = Color(0xFFFFF4E5)
val FreshRose = Color(0xFFF43F5E)
val FreshRoseSoft = Color(0xFFFFE9EC)
val FreshInk = Color(0xFF1C1917)        // warm near-black ink
val FreshMuted = Color(0xFF78716C)
val FreshBg = Color(0xFFFAFAF9)         // warm off-white page
val FreshSurface = Color(0xFFFFFFFF)
val FreshChip = Color(0xFFF5F5F4)
val FreshDivider = Color(0xFFE7E5E4)

val LoginGradient = Brush.linearGradient(
    listOf(Color(0xFFEA580C), Color(0xFFF97316), Color(0xFFFB7185)),
)

private val FreshColors = lightColorScheme(
    primary = FreshGreen,
    onPrimary = Color.White,
    primaryContainer = FreshGreenSoft,
    onPrimaryContainer = FreshGreenDark,
    secondary = FreshViolet,
    onSecondary = Color.White,
    secondaryContainer = FreshVioletSoft,
    onSecondaryContainer = FreshGreenDark,
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
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 14.sp,
    ),
    labelSmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
    ),
)

private val FreshShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(28.dp),
)

@Composable
fun FreshTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = FreshColors,
        typography = FreshType,
        shapes = FreshShapes,
        content = content,
    )
}

/** Alias kept for MainActivity (expects FreshCustomerTheme). */
@Composable
fun FreshCustomerTheme(content: @Composable () -> Unit) {
    FreshTheme(content)
}
