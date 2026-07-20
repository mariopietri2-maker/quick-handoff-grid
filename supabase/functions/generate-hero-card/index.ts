// Generates a hero-card image via Lovable AI Gateway and returns base64.
// Body: { prompt, title?, style?, placement?, source_image_url? }
// Returns: { b64_json: string }
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const STYLE_DIRECTION: Record<string, string> = {
  editorial:
    "editorial magazine cover photography, soft natural lighting, shallow depth of field, refined plating",
  lifestyle:
    "lifestyle food photography, airy daylight, lived-in table setting, warm inviting atmosphere",
  cinematic:
    "cinematic food still, dramatic contrast, moody highlights, premium dark ambience",
  minimal:
    "minimal Scandinavian food styling, clean negative space, soft pastel backdrop, precise composition",
  bold:
    "bold commercial promo photography, vibrant appetite colors, high energy, clear focal subject",
};

const PLACEMENT_FRAMING: Record<string, string> = {
  hero: "wide promotional banner framing, generous left negative space for headline text",
  spotlight: "landscape feature frame, centered subject with soft vignette edges",
  strip: "compact square-friendly crop, strong central subject, readable at small size",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "Missing LOVABLE_API_KEY" }, 500);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user?.id) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: u.user.id, _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const { prompt, title, style, placement, source_image_url } = body as {
      prompt: string;
      title?: string;
      style?: string;
      placement?: string;
      source_image_url?: string;
    };
    if (!prompt || typeof prompt !== "string") return json({ error: "prompt required" }, 400);

    const styleLine = STYLE_DIRECTION[style ?? ""] ?? STYLE_DIRECTION.editorial;
    const frameLine = PLACEMENT_FRAMING[placement ?? ""] ?? PLACEMENT_FRAMING.hero;

    const fullPrompt = [
      "Professional food-delivery marketing hero image for a premium mobile app.",
      title ? `Campaign theme: "${title}".` : "",
      `Visual style: ${styleLine}.`,
      `Composition: ${frameLine}.`,
      source_image_url ? `Use this visual reference for subject/mood (do not copy logos/text): ${source_image_url}` : "",
      `Creative direction: ${prompt}.`,
      "Photorealistic, appetite-appealing, no embedded text, no watermarks, no UI chrome, no logos.",
    ].filter(Boolean).join(" ");

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-image-2",
        prompt: fullPrompt,
        quality: "medium",
        size: placement === "strip" ? "1024x1024" : "1536x1024",
        n: 1,
        stream: false,
      }),
    });

    if (upstream.status === 429) return json({ error: "Rate limited" }, 429);
    if (upstream.status === 402) return json({ error: "AI credits exhausted" }, 402);
    if (!upstream.ok) {
      const detail = await upstream.text();
      return json({ error: "Gateway error", detail }, upstream.status);
    }
    const data = await upstream.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return json({ error: "No image returned" }, 502);

    return json({ b64_json: b64 });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
