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

/** Fresh Meal blue palette — deep PAS Giannina blue primary with ice-white surfaces. */
val FreshGreen = Color(0xFF1B4BA0)      // primary blue
val FreshGreenDark = Color(0xFF12336E)  // deep blue
val FreshGreenSoft = Color(0xFFDCE6FB)  // blue chip
val FreshTeal = Color(0xFF2E6FE0)       // bright brand blue
val FreshTealDark = Color(0xFF1B4BA0)
val FreshTealSoft = Color(0xFFE3ECFB)
val FreshGold = Color(0xFFF7B955)
val FreshViolet = Color(0xFF2E6FE0)
val FreshVioletSoft = Color(0xFFE3ECFB)
val FreshAmber = Color(0xFFF59E0B)
val FreshAmberSoft = Color(0xFFFFF4E5)
val FreshRose = Color(0xFFF43F5E)
val FreshRoseSoft = Color(0xFFFFE9EC)
val FreshInk = Color(0xFF10224A)        // deep blue ink
val FreshMuted = Color(0xFF5A719C)
val FreshBg = Color(0xFFF2F7FF)         // ice-white page
val FreshSurface = Color(0xFFFFFFFF)
val FreshChip = Color(0xFFE4EDFC)
val FreshDivider = Color(0xFFDCE5F5)

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
    medium = RoundedCornerShape(20.dp),
    large = RoundedCornerShape(26.dp),
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
