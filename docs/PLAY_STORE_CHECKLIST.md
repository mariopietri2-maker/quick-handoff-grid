# Play Store — complete checklist

## A. Code / CI (repo)

- [x] Customer release signing (Play keystore env)
- [x] Customer release minify, non-debuggable
- [x] Customer remove REQUEST_INSTALL_PACKAGES on release
- [x] Customer disable sideload updater on Play builds
- [x] Driver same as above
- [x] Privacy / terms at fresh2go.gr/legal/*
- [x] Listing + data safety text in docs/

## B. GitHub secrets

- [ ] PLAY_CUSTOMER_KEYSTORE_B64
- [ ] PLAY_DRIVER_KEYSTORE_B64
- [ ] PLAY_STORE_PASSWORD
- [ ] PLAY_KEY_PASSWORD

## C. Build AAB

1. Actions → Build Native Play Store AABs
2. version_code > last Play version (often ≥ 7233000)
3. Download fresh2go-customer-native-release.aab

## D. Play Console (customer)

- [ ] Store listing (PLAY_STORE_LISTING.md)
- [ ] Privacy policy URL
- [ ] Data safety (PLAY_STORE_DATA_SAFETY.md)
- [ ] Content rating questionnaire
- [ ] Ads declaration (usually no ads)
- [ ] Closed testing → upload AAB → testers
- [ ] Roll out closed test
