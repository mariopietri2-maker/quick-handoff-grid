# Deploy Fresh Delivery web on Vercel (temporary)

Backend stays on **Supabase**. Vercel only hosts the Vite frontend.

## 1. Import the repo

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import **mariopietri2-maker/quick-handoff-grid**
3. Framework: **Vite** (auto)
4. Build: `npm run build` · Output: `dist` · Install: `npm install`
5. Node: **20.x**

## 2. Environment variables (Production)

Set these in Vercel → Project → Settings → Environment Variables:

```
VITE_SUPABASE_PROJECT_ID=ojkesspghyqmjmupybva
VITE_SUPABASE_URL=https://ojkesspghyqmjmupybva.supabase.co
VITE_SUPABASE_ANON_KEY=<your anon key>
VITE_SUPABASE_PUBLISHABLE_KEY=<same anon key>
VITE_MAPBOX_TOKEN=<your mapbox pk>
VITE_PAYMENTS_CLIENT_TOKEN=<stripe pk if used>
```

If `.env.production` is in the repo, the build script may already force the Supabase URL/keys from that file.

## 3. Deploy

Click **Deploy**. You get a URL like `https://quick-handoff-grid-xxx.vercel.app`.

## 4. After deploy

- Supabase Auth → URL configuration: add the Vercel URL to **Site URL** / **Redirect URLs**
- Mapbox token: allow the Vercel domain if restricted by URL

Railway can stay as-is; use Vercel until Railway is fine again.
