// Parses pasted receipt text from eFood / Wolt / Box / generic into a structured order.
import { rateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";
import { getAuthedUser, unauthorized } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY") || Deno.env.get("LOVABLE_API_KEY");

const ORDER_SYSTEM_PROMPT = `You extract structured delivery-order data from raw receipt or notification text from food-delivery platforms (eFood, Wolt, Box) or any plain text the operator pastes.

Return ONLY valid JSON matching this shape:
{
  "source": "efood" | "wolt" | "box" | "other",
  "total_amount": number,            // total order value in EUR
  "delivery_address": string,        // full street + number + city if available
  "customer_name": string | null,
  "customer_phone": string | null,
  "items_summary": string,           // 1-line summary like "2x Pizza Margherita, 1x Coke"
  "external_ref": string | null,     // order number / id from the platform if any
  "notes": string | null             // anything special (allergies, intercom, etc.)
}

Rules:
- Detect the source from logos/keywords (efood, e-food, wolt, box.gr).
- Numbers must be plain numbers, no currency symbols.
- If a field is missing, use null (or empty string for items_summary).
- Never invent data — only extract what's present.`;

const MENU_SYSTEM_PROMPT = `You extract a restaurant menu from raw text the operator pastes (copied from eFood, Wolt, Box, their website, or a word doc). It may list dishes grouped by category (e.g. "— Pizzas —", "Ανάμεικτες Σαλάτες").

Return ONLY valid JSON:
{
  "source": "efood" | "wolt" | "box" | "other",
  "menu_items": [
    { "name": string, "price": number, "category": string | null, "description": string | null }
  ]
}

Rules:
- Each distinct dish becomes one entry — do NOT combine duplicates; if the same dish appears, keep it once.
- Prices are EUR, plain numbers (strip €/currency).
- If a dish has no price visible, use 0.
- Infer category from section headers when present, else set null.
- Keep descriptions only if clearly attached to that dish; otherwise null.
- Never invent dishes — only extract what's present. If nothing looks like a menu, return "menu_items": [].`;

interface ParseRequest {
  text: string;
  mode?: string; // "menu" → also extract menu_items for store menu migration
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!AI_GATEWAY_API_KEY) throw new Error("AI_GATEWAY_API_KEY not configured");

    // Require an authenticated store/admin user — receipt parsing is an operator workflow.
    const user = await getAuthedUser(req);
    if (!user || !(user.isAdmin || user.isSupport || user.isStore)) {
      return unauthorized(corsHeaders);
    }

    // Rate limit: 20 parses/min per user (burst 5) — receipt parsing is expensive
    const rl = rateLimit(`u:${user.id}`, { capacity: 5, refillPerMinute: 20 });
    if (!rl.allowed) return rateLimitResponse(rl.retryAfter, corsHeaders);

    const body = (await req.json()) as ParseRequest;
    const text = (body?.text ?? "").toString().trim();
    if (!text || text.length < 5) {
      return new Response(JSON.stringify({ error: "Text is too short" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (text.length > 8000) {
      return new Response(JSON.stringify({ error: "Text too long (max 8000 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SYSTEM_PROMPT = body?.mode === "menu" ? MENU_SYSTEM_PROMPT : ORDER_SYSTEM_PROMPT;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited, try again" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const t = await response.text();
      throw new Error(`AI gateway error ${response.status}: ${t}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);

    return new Response(JSON.stringify({ success: true, data: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("parse-receipt error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
