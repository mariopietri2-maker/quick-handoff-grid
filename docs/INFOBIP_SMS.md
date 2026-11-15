# Infobip SMS (Fresh2GO phone OTP)

## Secrets (Supabase → Edge Functions → Secrets)

| Name | Example | Required |
|------|---------|----------|
| `INFOBIP_API_KEY` | your API key from Infobip portal | Yes |
| `INFOBIP_BASE_URL` | `https://xxxxx.api.infobip.com` (from dashboard) | Recommended |
| `INFOBIP_FROM` | `Fresh2GO` or approved sender / number | Yes for production |

Default base URL if unset: `https://api.infobip.com`

## Deploy

```bash
supabase functions deploy send-phone-otp
```

`verify-phone-otp` is unchanged (checks `phone_otps` table).

## Infobip portal

1. Create account → **Developer tools** → **API keys**
2. Copy **Base URL** (often `https://<subdomain>.api.infobip.com`)
3. Configure SMS sender (alphanumeric or number) for Greece if required
