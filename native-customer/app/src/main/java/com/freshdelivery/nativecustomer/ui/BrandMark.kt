package com.freshdelivery.nativecustomer.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Static Fresh2GO bag mark (matches website / launcher brand).
 * Orange → pink gradient tile with white bag.
 */
@Composable
fun Fresh2GoBagMark(
    modifier: Modifier = Modifier,
    size: Dp = 72.dp,
) {
    Canvas(modifier.then(Modifier.size(size))) {
        val w = this.size.width
        val h = this.size.height
        val s = w / 64f

        drawRoundRect(
            brush = Brush.linearGradient(
                colors = listOf(
                    Color(0xFFF4A125),
                    Color(0xFFFF8A3D),
                    Color(0xFFE94E8F),
                ),
                start = Offset.Zero,
                end = Offset(w, h),
            ),
            cornerRadius = CornerRadius(16f * s, 16f * s),
        )

        // Handle
        val handle = Path().apply {
            moveTo(26f * s, 28f * s)
            quadraticBezierTo(32f * s, 20f * s, 38f * s, 28f * s)
        }
        drawPath(
            handle,
            color = Color.White,
            style = Stroke(width = 3.2f * s, cap = StrokeCap.Round),
        )

        // Bag body
        drawRoundRect(
            color = Color.White,
            topLeft = Offset(19.5f * s, 27f * s),
            size = Size(25f * s, 22f * s),
            cornerRadius = CornerRadius(6f * s, 6f * s),
        )

        // Fold line
        drawLine(
            color = Color(0xFFFF8A3D),
            start = Offset(23f * s, 35f * s),
            end = Offset(41f * s, 35f * s),
            strokeWidth = 2.2f * s,
            cap = StrokeCap.Round,
        )
    }
}
