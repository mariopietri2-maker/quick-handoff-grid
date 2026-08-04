# Railway deployment: build the Vite SPA, serve it as static files.
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

COPY . .
# Vite inlines VITE_* vars at build time — set them in Railway service variables.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SUPABASE_PROJECT_ID
ARG VITE_MAPBOX_TOKEN
ARG VITE_PAYMENTS_CLIENT_TOKEN
RUN npm run build:vite

FROM node:20-alpine AS runtime
WORKDIR /app
RUN npm install -g serve@14
COPY --from=build /app/dist ./dist
ENV PORT=8080
EXPOSE 8080
# -s => SPA fallback so deep links / refresh work
CMD ["sh", "-c", "serve -s dist -l ${PORT}"]
