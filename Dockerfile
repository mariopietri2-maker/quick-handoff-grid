# FreshDelivery web — Railway main host
# Multi-stage: Vite build → nginx static serve with SPA fallback.

# ── Stage 1: build ──────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Capacitor Mapbox plugin builds from source on fresh clones (no lockfile yet).
RUN npm --prefix plugins/capacitor-mapbox-maps install --no-audit --no-fund --loglevel=error

# Vite bakes env vars at build time — supplied via Railway Variables.
ARG VITE_SUPABASE_PROJECT_ID
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_PAYMENTS_CLIENT_TOKEN
ARG VITE_MAPBOX_TOKEN
ENV VITE_SUPABASE_PROJECT_ID="$VITE_SUPABASE_PROJECT_ID" \
    VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
    VITE_SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY" \
    VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY" \
    VITE_PAYMENTS_CLIENT_TOKEN="$VITE_PAYMENTS_CLIENT_TOKEN" \
    VITE_MAPBOX_TOKEN="$VITE_MAPBOX_TOKEN"

RUN npm run build

# ── Stage 2: serve ──────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
