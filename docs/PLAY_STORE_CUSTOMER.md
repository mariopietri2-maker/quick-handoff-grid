# Play Store — Native Customer (`com.freshdelivery.customer`)

## Build signed AAB

1. Repo secrets (Settings → Secrets → Actions):
   - `PLAY_CUSTOMER_KEYSTORE_B64` — base64 of upload `.jks`
   - `PLAY_STORE_PASSWORD`
   - `PLAY_KEY_PASSWORD`
   - Alias: `fresh2go-customer`

2. Run workflow **Build Native Play Store AABs**
   - Set `version_code` **higher** than the last version in Play Console
     (same package as Capacitor → often ≥ `7233000`)
   - Optional `version_name` e.g. `2.9.12`

3. Download artifact:
   `fresh2go-customer-native-release.aab`

4. Play Console → Testing → Closed testing → Create release → upload AAB

## Play readiness (code)

| Item | Status |
|------|--------|
| `applicationId` | `com.freshdelivery.customer` |
| `targetSdk` | 35 |
| Release minify + shrink | Yes |
| Release signing | CI env / key.properties |
| `REQUEST_INSTALL_PACKAGES` | Removed on release |
| Sideload auto-update | Disabled on Play builds |
| Cleartext traffic | Off |
| Debuggable release | No |

## Console checklist (you)

- [ ] App name, short/full description (Greek)
- [ ] Icon 512×512, feature graphic 1024×500
- [ ] Phone screenshots
- [ ] Privacy policy URL
- [ ] Data safety form
- [ ] Content rating
- [ ] Closed testing track + testers
