package com.freshdelivery.nativecustomer.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.freshdelivery.nativecustomer.R

/**
 * Launch splash — solid brand orange with the white Fresh2GO mark,
 * same pattern as the efood full-color splash.
 */
@Composable
fun SplashScreen(
    appName: String = "Fresh2GO",
    tagline: String = "Fresh Meals. Fast Delivery.",
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFEA580C)),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Image(
                painter = painterResource(R.drawable.ic_logo_white),
                contentDescription = "Fresh2GO",
                modifier = Modifier.size(220.dp),
            )
            Spacer(Modifier.height(8.dp))
            Text(
                appName,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 40.sp,
            )
        }
    }
}
