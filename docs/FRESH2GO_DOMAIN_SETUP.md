# fresh2go.gr → Railway setup

The app is already live at **https://freshdelivery.app** (Railway).
`fresh2go.gr` is registered but currently shows a **registrar parking page**
(DNS points at `195.110.124.140`, not Railway).

## 1) Railway — add custom domain

1. Open [Railway dashboard](https://railway.app) → project **quick-handoff-grid** (or your prod service).
2. Select the **web** service that serves `freshdelivery.app`.
3. **Settings → Public Networking → + Custom Domain**.
4. Add:
   - `fresh2go.gr`
   - `www.fresh2go.gr`
5. Railway shows **CNAME** + **TXT** records — copy both exactly.

## 2) Domain registrar DNS (where you bought fresh2go.gr)

Remove the parking / default A record to `195.110.124.140`.

Add the records Railway gave you, for example:

| Type | Host | Value |
|------|------|-------|
| **CNAME** or **ALIAS/ANAME** | `@` (root) | `xxxx.up.railway.app` (from Railway) |
| **CNAME** | `www` | same Railway target |
| **TXT** | (as Railway shows) | ownership verification value |

Notes:
- Root domains often need **ALIAS/ANAME** instead of CNAME — use whatever your registrar supports.
- Both **CNAME and TXT** are required; without TXT Railway returns 404.
- Propagation can take minutes to a few hours (rarely up to 48h).

## 3) Supabase Auth (dashboard)

**Authentication → URL configuration**

- Site URL: keep `https://freshdelivery.app` *or* switch to `https://fresh2go.gr` if that becomes primary.
- Additional Redirect URLs — add:
  - `https://fresh2go.gr/**`
  - `https://www.fresh2go.gr/**`

## 4) Verify

```bash
curl -I https://fresh2go.gr
# expect HTTP/2 200 and server railway-hikari (or similar)
```

Repo already allowlists `https://fresh2go.gr/*` in Capacitor configs and password-reset redirects.
