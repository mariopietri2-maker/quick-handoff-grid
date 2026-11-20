# Fresh2GO Customer — iOS (App Store project)

Native **SwiftUI** customer app for Ioannina — same Supabase backend as Android.

## Bundle
- **Name:** Fresh2GO
- **Bundle ID:** `com.freshdelivery.customer`
- **Version:** 1.0.0 (build 1)
- **Min iOS:** 16.0

## Features
- Email login / signup with Terms + Privacy checkboxes
- Home store list (Supabase)
- Store menu
- Cart + place order (cash/card)
- Orders history
- Profile + legal links
- PrivacyInfo.xcprivacy + Info.plist usage strings

## Build & upload (Mac + Xcode)

```bash
cd native-customer-ios
brew install xcodegen   # once
xcodegen generate
open Fresh2GOCustomer.xcodeproj
```

In Xcode:
1. Signing & Capabilities → select your **Team**
2. Destination: **Any iOS Device (arm64)**
3. **Product → Archive**
4. **Distribute App → App Store Connect → Upload**

## App Store Connect
- Privacy Policy: https://fresh2go.gr/legal/privacy
- Category: Food & Drink
- Encryption: standard HTTPS only (exempt)

## Support
support@fresh2go.gr
