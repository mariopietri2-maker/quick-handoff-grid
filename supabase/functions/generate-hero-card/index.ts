// Generates an AI hero-card image via Lovable AI Gateway and stores it.
// Body: { card_id?: string, prompt: string, title?: string, source_image_url?: string }
// Returns: { image_url, card_id }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return json({ error: "Missing LOVABLE_API_KEY" }, 500);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // AuthN — only admins can call
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const { card_id, prompt, title, source_image_url } = body as {
      card_id?: string; prompt: string; title?: string; source_image_url?: string;
    };
    if (!prompt || typeof prompt !== "string") {
      return json({ error: "prompt required" }, 400);
    }

    // Build the image prompt. We can't pass URL-based reference to /v1/images/generations,
    // so we describe it in text and add the user prompt.
    const fullPrompt = [
      "Design a premium food-delivery promo hero banner.",
      title ? `Headline subject: "${title}".` : "",
      source_image_url
        ? `Inspired by a reference photo at ${source_image_url} — match its mood and main subject.`
        : "",
      `Creative direction: ${prompt}.`,
      "Wide 16:9 layout, vibrant appetite-appealing colors, soft natural lighting,",
      "clean negative space on the right for headline text, no embedded text or watermark.",
    ].filter(Boolean).join(" ");

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-image-2",
        prompt: fullPrompt,
        quality: "low",
        size: "1536x1024",
        n: 1,
        stream: false,
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return json({ error: "Gateway error", detail: errText }, upstream.status);
    }
    const data = await upstream.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return json({ error: "No image returned" }, 502);

    // Decode base64 → bytes and upload
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const filename = `${userId}/${Date.now()}-${crypto.randomUUID()}.png`;
    const up = await admin.storage.from("ai-hero-cards").upload(filename, bytes, {
      contentType: "image/png",
      upsert: false,
    });
    if (up.error) return json({ error: "Upload failed", detail: up.error.message }, 500);

    const { data: pub } = admin.storage.from("ai-hero-cards").getPublicUrl(filename);
    const image_url = pub.publicUrl;

    let savedId = card_id;
    if (card_id) {
      await admin.from("ai_hero_cards").update({
        image_url, prompt, source_image_url, updated_at: new Date().toISOString(),
      }).eq("id", card_id);
    }

    return json({ image_url, card_id: savedId ?? null });
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
