/** Resolve AI gateway API key (legacy LOVABLE_API_KEY still accepted). */
export function getAiGatewayApiKey(): string | undefined {
  return Deno.env.get("AI_GATEWAY_API_KEY") || Deno.env.get("LOVABLE_API_KEY") || undefined;
}

export const AI_GATEWAY_BASE = "https://ai.gateway.lovable.dev";
