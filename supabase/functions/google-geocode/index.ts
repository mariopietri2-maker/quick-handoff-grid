// Google Geocoding proxy — keeps the API key server-side.
// POST { q: <address> }  → { result: { latitude, longitude, formatted } | null }
// Checks shared address cache first (Mapbox/Google cost savings), then Google.
// Requires an authenticated app user to prevent quota abuse.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import { getAuthedUser, unauthorized } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getAuthedUser(req);
  if (!user) return unauthorized(corsHeaders);

  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({ error: "GOOGLE_MAPS_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Accept both POST body { q } and legacy ?q= for compatibility.
  let q = "";
  const url = new URL(req.url);
  q = (url.searchParams.get("q") ?? "").trim();
  if (!q && req.method === "POST") {
    try {
      const body = await req.json();
      q = String(body?.q ?? "").trim();
    } catch { /* ignore */ }
  }
  if (!q || q.length > 300) {
    return new Response(JSON.stringify({ error: "missing or invalid q" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    // Shared DB cache — skip Google when another customer already resolved this address.
    const { data: cached } = await admin.rpc("lookup_address_geocode", { p_q: q });
    const hit = Array.isArray(cached) ? cached[0] : cached;
    if (hit?.latitude != null && hit?.longitude != null) {
      return new Response(JSON.stringify({
        result: {
          latitude: Number(hit.latitude),
          longitude: Number(hit.longitude),
          formatted: hit.display_address ?? q,
        },
        status: "CACHE",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch { /* fall through to Google */ }

  try {
    const bounds = "39.45,20.55|39.90,21.20";
    const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&region=gr&language=el&components=country:GR&bounds=${encodeURIComponent(bounds)}&key=${key}`;
    const res = await fetch(gUrl);
    const json = await res.json();
    const r = json?.results?.[0];
    if (!r?.geometry?.location) {
      return new Response(JSON.stringify({ result: null, status: json?.status ?? "ZERO_RESULTS" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { lat, lng } = r.geometry.location;
    const formatted = r.formatted_address ?? q;

    // Remember for future customers / reverse-geocode nearby reuse.
    try {
      await admin.rpc("remember_address_geocode", {
        p_q: q,
        p_display: formatted,
        p_lat: lat,
        p_lng: lng,
        p_source: "google",
      });
    } catch { /* non-fatal */ }

    return new Response(JSON.stringify({
      result: { latitude: lat, longitude: lng, formatted },
      status: "OK",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
