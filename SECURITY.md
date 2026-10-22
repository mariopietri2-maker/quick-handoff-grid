# Fresh2GO — Security checklist

## Immediate (after Railway / any platform breach)

1. **Rotate every secret** that ever lived in Railway, Vercel, Netlify, or this chat:
   - Supabase: service role key, database password, JWT secret (dashboard → Settings → API)
   - GitHub: personal access tokens (`ghp_…`) — revoke in GitHub → Settings → Developer settings
   - Mapbox, Stripe/Viva, push (FCM), SMTP, any third-party API keys
2. **Revoke at the source**, then put the **new** values only in the host’s secret store (never in git).
3. Review Supabase **Auth logs** and **API logs** for unusual traffic.
4. Review GitHub **security log** for unexpected pushes or token use.

## What is safe in the browser

| Key | Public? |
|-----|---------|
| Supabase **anon** / publishable key | Yes (protected by RLS) |
| Mapbox **pk.** token | Yes (restrict by URL in Mapbox dashboard) |
| Stripe **pk_live_** | Yes |
| Supabase **service_role** | **Never** in client or git |
| `sk_`, `whsec_`, DB password, `ghp_`, `sbp_` | **Never** in client or git |

## App controls (implemented)

- Password policy: min 8 chars, letter + number, blocks common weak passwords
- Security headers: HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy
- Admin idle logout: 30 minutes without activity
- Edge functions use service role only on the server (Deno.env)

## Ongoing

- Prefer **RLS** on every table; edge functions for privileged actions
- Mapbox: restrict token to `fresh2go.gr` and app package names
- Supabase: enable **leaked password protection** if available on your plan
- Do not paste live tokens into chat; use short-lived tokens and rotate after use
- Keep GitHub repo private; never commit `.env` with secrets

## After rotating

1. Update Vercel / Netlify / Railway / Supabase Edge secrets  
2. Redeploy web + rebuild native apps if they embed config  
3. Confirm login + one test order end-to-end  
