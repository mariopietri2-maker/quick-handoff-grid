# SMS phone verification (Fresh2GO)

## Required Supabase secrets (Edge Functions)
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM` (e.g. +30... or messaging service)

## Functions
- `send-phone-otp`
- `verify-phone-otp`

## UI
- `PhoneSmsVerify` component
- Auth signup can continue to SMS step

## Deploy functions
```bash
supabase functions deploy send-phone-otp
supabase functions deploy verify-phone-otp
```

Without Twilio secrets, send returns `sms_not_configured`.
