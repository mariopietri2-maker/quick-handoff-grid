/** Optional AI gateway. Set AI_GATEWAY_API_KEY + AI_GATEWAY_BASE in Supabase secrets. */
export function getAiGatewayApiKey(): string | undefined {
  return Deno.env.get("AI_GATEWAY_API_KEY") || undefined;
}

export const AI_GATEWAY_BASE = Deno.env.get("AI_GATEWAY_BASE") || "";
