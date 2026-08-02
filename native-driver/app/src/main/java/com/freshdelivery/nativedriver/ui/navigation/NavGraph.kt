package com.freshdelivery.nativedriver.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.freshdelivery.nativedriver.ui.home.HomeScreen
import com.freshdelivery.nativedriver.ui.login.LoginScreen
import com.freshdelivery.nativedriver.ui.login.LoginViewModel

private object Routes {
    const val LOGIN = "login"
    const val HOME = "home"
}

@Composable
fun DriverNavGraph(navController: NavHostController = rememberNavController()) {
    val loginViewModel: LoginViewModel = viewModel()
    val uiState by loginViewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(uiState.isAuthenticated) {
        val target = if (uiState.isAuthenticated) Routes.HOME else Routes.LOGIN
        if (navController.currentDestination?.route != target) {
            navController.navigate(target) {
                popUpTo(0) { inclusive = true }
            }
        }
    }

    NavHost(navController = navController, startDestination = Routes.LOGIN) {
        composable(Routes.LOGIN) { LoginScreen(viewModel = loginViewModel) }
        composable(Routes.HOME) {
            HomeScreen(driverEmail = uiState.email, onSignOut = loginViewModel::signOut)
        }
    }
}
