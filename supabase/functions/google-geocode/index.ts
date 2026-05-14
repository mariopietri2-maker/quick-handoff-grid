// Google Geocoding proxy — keeps the API key server-side.
// GET ?q=<address>  → { latitude, longitude, formatted } | { error }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({ error: "GOOGLE_MAPS_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) {
    return new Response(JSON.stringify({ error: "missing q" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Bias results to Ioannina region (city is the only operating area). The
    // `bounds` rectangle is a soft hint; `components=locality:Ioannina` would
    // be too strict, so we keep country:GR and rely on the bounds + proximity.
    const bounds = "39.55,20.70|39.78,21.00";
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
    return new Response(JSON.stringify({
      result: { latitude: lat, longitude: lng, formatted: r.formatted_address ?? q },
      status: "OK",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
