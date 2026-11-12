#!/usr/bin/env python3
from pathlib import Path
import re

# --- AndroidManifest: Google Pay meta-data ---
mf = Path('native-customer/app/src/main/AndroidManifest.xml')
mt = mf.read_text()
if 'com.google.android.gms.wallet.api.enabled' not in mt:
    mt = mt.replace(
        '        <provider',
        '''        <meta-data
            android:name="com.google.android.gms.wallet.api.enabled"
            android:value="true" />

        <provider''',
        1,
    )
    mf.write_text(mt)
    print('manifest google pay meta')
else:
    print('manifest already has wallet')

# --- MainActivity: Test vs Production from publishable key ---
main = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/MainActivity.kt')
t = main.read_text()
old = '''                    // Google Pay (EUR) when device supports it
                    runCatching {
                        configBuilder.googlePay(
                            PaymentSheet.GooglePayConfiguration(
                                environment = PaymentSheet.GooglePayConfiguration.Environment.Production,
                                countryCode = "GR",
                                currencyCode = "EUR",
                            ),
                        )
                    }'''
new = '''                    // Google Pay (EUR) — Test env when using pk_test_ keys
                    runCatching {
                        val gpEnv =
                            if (req.publishableKey.startsWith("pk_test"))
                                PaymentSheet.GooglePayConfiguration.Environment.Test
                            else
                                PaymentSheet.GooglePayConfiguration.Environment.Production
                        configBuilder.googlePay(
                            PaymentSheet.GooglePayConfiguration(
                                environment = gpEnv,
                                countryCode = "GR",
                                currencyCode = "EUR",
                            ),
                        )
                    }'''
if old in t:
    t = t.replace(old, new, 1)
    main.write_text(t)
    print('MainActivity GP env')
else:
    print('MainActivity pattern miss')

print('done')
