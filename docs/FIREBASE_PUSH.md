# Firebase Cloud Messaging (Android push)

Killed-app / locked-phone offers need FCM. Local notifications already cover
backgrounded-but-alive sessions.

## 1. Create Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/) → Add project  
2. Add **two** Android apps:
   - `com.freshdelivery.customer`
   - `com.freshdelivery.driver`
3. Download each `google-services.json`

## 2. Place files (gitignored)

```bash
mkdir -p mobile-signing/firebase
# either one file per flavor:
cp ~/Downloads/google-services-customer.json mobile-signing/firebase/google-services.customer.json
cp ~/Downloads/google-services-driver.json   mobile-signing/firebase/google-services.driver.json
# or one shared file (same Firebase project with both package names registered):
# cp ~/Downloads/google-services.json mobile-signing/firebase/google-services.json
```

## 3. Edge secret (server → FCM)

**Preferred (HTTP v1):** Project settings → Service accounts → Generate new private key  
Save as `mobile-signing/firebase/firebase-service-account.json`

```bash
./scripts/set-fcm-secret.sh
```

**Legacy:** Cloud Messaging → Server key →  
`mobile-signing/firebase/fcm-server-key.txt` then run the same script.

## 4. Rebuild APKs

```bash
./scripts/apply-firebase-android.sh   # copies into android-*/app/
npm run mobile:apk
```

`scripts/build-apks.sh` calls `apply-firebase-android.sh` automatically when present.

## 5. Verify

- Install customer + driver APKs  
- Sign in → grant notification permission  
- Confirm a row in `push_tokens`  
- Trigger an offer / order status → `push_outbox` drains via `send-push`
