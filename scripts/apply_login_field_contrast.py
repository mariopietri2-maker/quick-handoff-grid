#!/usr/bin/env python3
from pathlib import Path

d = Path('native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/auth/LoginScreen.kt')
dt = d.read_text(encoding='utf-8')
old_d = '''@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = FreshGreen,
    unfocusedBorderColor = MaterialTheme.colorScheme.outline,
    focusedLabelColor = FreshGreen,
    cursorColor = FreshGreen,
)'''
new_d = '''@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = Color.White,
    unfocusedTextColor = Color.White,
    disabledTextColor = Color(0xFFA8A29E),
    focusedContainerColor = Color(0xFF292524),
    unfocusedContainerColor = Color(0xFF1C1917),
    disabledContainerColor = Color(0xFF1C1917),
    cursorColor = FreshGreen,
    focusedBorderColor = FreshGreen,
    unfocusedBorderColor = Color(0xFF78716C),
    focusedLabelColor = FreshGreenBright,
    unfocusedLabelColor = Color(0xFFD6D3D1),
    focusedPlaceholderColor = Color(0xFFA8A29E),
    unfocusedPlaceholderColor = Color(0xFF78716C),
    focusedLeadingIconColor = FreshGreenBright,
    unfocusedLeadingIconColor = Color(0xFFA8A29E),
    focusedTrailingIconColor = Color.White,
    unfocusedTrailingIconColor = Color(0xFFA8A29E),
)'''
if 'focusedTextColor = Color.White' in dt:
    print('driver already')
elif old_d in dt:
    d.write_text(dt.replace(old_d, new_d), encoding='utf-8')
    print('driver patched')
else:
    print('WARN driver')

c = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/LoginScreen.kt')
ct = c.read_text(encoding='utf-8')
old_c = '''    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = FreshGreen,
        focusedLabelColor = FreshGreen,
        cursorColor = FreshGreen,
    )'''
new_c = '''    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedTextColor = Color(0xFF1C1917),
        unfocusedTextColor = Color(0xFF1C1917),
        disabledTextColor = Color(0xFF78716C),
        focusedContainerColor = Color.White,
        unfocusedContainerColor = Color.White,
        disabledContainerColor = Color(0xFFF5F5F4),
        cursorColor = FreshGreen,
        focusedBorderColor = FreshGreen,
        unfocusedBorderColor = Color(0xFFD6D3D1),
        focusedLabelColor = FreshGreenDark,
        unfocusedLabelColor = Color(0xFF57534E),
        focusedPlaceholderColor = Color(0xFFA8A29E),
        unfocusedPlaceholderColor = Color(0xFFA8A29E),
        focusedLeadingIconColor = FreshGreen,
        unfocusedLeadingIconColor = Color(0xFF78716C),
        focusedTrailingIconColor = Color(0xFF1C1917),
        unfocusedTrailingIconColor = Color(0xFF78716C),
    )'''
if 'focusedTextColor = Color(0xFF1C1917)' in ct:
    print('customer already')
elif old_c in ct:
    if 'import androidx.compose.ui.graphics.Color' not in ct:
        ct = ct.replace(
            'import androidx.compose.material3.OutlinedTextFieldDefaults',
            'import androidx.compose.material3.OutlinedTextFieldDefaults\nimport androidx.compose.ui.graphics.Color',
        )
    c.write_text(ct.replace(old_c, new_c), encoding='utf-8')
    print('customer patched')
else:
    print('WARN customer')
print('done')
