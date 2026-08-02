// Support AI — draft / send replies, triage, and optional auto-answer queue.
// Auth: support/admin JWT, OR cron secret for process_queue / health_check.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimit, rateLimitResponse, clientKey } from "../_shared/rate-limit.ts";
import { getAiGatewayApiKey, AI_GATEWAY_BASE } from "../_shared/ai-gateway.ts";
import { hasCronSecret } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

type Action =
  | "suggest_reply"
  | "send_reply"
  | "summarize"
  | "triage"
  | "custom"
  | "process_queue"
  | "health_check";

function requesterLabel(role: string | null | undefined): string {
  switch (role) {
    case "customer": return "πελάτη";
    case "store": return "κατάστημα";
    case "driver": return "οδηγό";
    default: return "χρήστη";
  }
}

function mapTriagePriority(p?: string): string | null {
  switch ((p || "").toLowerCase()) {
    case "critical":
    case "sos":
      return "sos";
    case "high":
      return "high";
    case "medium":
    case "normal":
      return "normal";
    case "low":
      return "low";
    default:
      return null;
  }
}

async function callAi(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  cheap: boolean,
): Promise<{ content: string; status: number; errorText?: string }> {
  const model = cheap
    ? "google/gemini-2.5-flash-lite"
    : "google/gemini-2.5-flash";
  const aiResp = await fetch(`${AI_GATEWAY_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!aiResp.ok) {
    return { content: "", status: aiResp.status, errorText: await aiResp.text() };
  }
  const aiData = await aiResp.json();
  return {
    content: String(aiData.choices?.[0]?.message?.content ?? "").trim(),
    status: 200,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = (body?.action ?? "") as Action;
    const ticketId = body?.ticketId as string | undefined;
    const customPrompt = body?.customPrompt as string | undefined;
    const preferCheap = body?.preferCheap !== false;
    const providedReply = typeof body?.replyText === "string" ? body.replyText.trim() : "";

    if (action === "health_check") {
      return new Response(JSON.stringify({ ok: true, service: "support-ai" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const needsGateway = !(action === "send_reply" && providedReply);
    const AI_GATEWAY_API_KEY = getAiGatewayApiKey();
    if (needsGateway && !AI_GATEWAY_API_KEY) throw new Error("AI_GATEWAY_API_KEY not configured");

    const cronOk = hasCronSecret(req);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    let callerId: string | null = null;
    let callerRole: "support" | "admin" | "cron" = "cron";

    if (action === "process_queue") {
      if (!cronOk) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callerId = userData.user.id;
      const { data: roles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", callerId);
      const roleSet = new Set((roles ?? []).map((r: { role: string }) => r.role));
      if (!roleSet.has("support") && !roleSet.has("admin")) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callerRole = roleSet.has("admin") ? "admin" : "support";

      const rl = rateLimit(clientKey(req, callerId), { capacity: 10, refillPerMinute: 30 });
      if (!rl.allowed) return rateLimitResponse(rl.retryAfter, corsHeaders);
    }

    // Feature flag kill-switch
    const { data: flagRow } = await admin
      .from("feature_flags")
      .select("is_enabled")
      .eq("key", "ai_support_enabled")
      .maybeSingle();
    if (flagRow && flagRow.is_enabled === false) {
      return new Response(JSON.stringify({ error: "AI Support είναι απενεργοποιημένο" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "process_queue") {
      const { data: autoFlag } = await admin
        .from("feature_flags")
        .select("is_enabled")
        .eq("key", "ai_support_auto_reply")
        .maybeSingle();
      if (!autoFlag?.is_enabled) {
        return new Response(JSON.stringify({ ok: true, skipped: "auto_reply_disabled", processed: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: openTickets } = await admin
        .from("support_tickets")
        .select("id, category, description, status, priority, requester_role, driver_id, order_id, created_at")
        .eq("status", "open")
        .neq("priority", "sos")
        .lt("created_at", new Date(Date.now() - 25_000).toISOString())
        .order("created_at", { ascending: true })
        .limit(8);

      let processed = 0;
      const results: Array<{ ticketId: string; ok: boolean; reason?: string }> = [];

      for (const ticket of openTickets ?? []) {
        if (processed >= 3) break;

        const { data: msgs } = await admin
          .from("ticket_messages")
          .select("sender_role, is_ai")
          .eq("ticket_id", ticket.id);
        const hasHumanAgent = (msgs ?? []).some(
          (m: { sender_role: string; is_ai?: boolean }) =>
            (m.sender_role === "support" || m.sender_role === "admin") && !m.is_ai,
        );
        const hasAi = (msgs ?? []).some((m: { is_ai?: boolean }) => m.is_ai);
        if (hasHumanAgent || hasAi) {
          results.push({ ticketId: ticket.id, ok: false, reason: "already_answered" });
          continue;
        }

        const reply = await buildReplyForTicket(admin, AI_GATEWAY_API_KEY, ticket, true, preferCheap);
        if (!reply.text) {
          results.push({ ticketId: ticket.id, ok: false, reason: reply.error || "empty" });
          continue;
        }

        // Prefer a real support user as sender; fall back to any admin.
        const { data: botRole } = await admin
          .from("user_roles")
          .select("user_id")
          .in("role", ["support", "admin"])
          .limit(1)
          .maybeSingle();
        const botId = botRole?.user_id;
        if (!botId) {
          results.push({ ticketId: ticket.id, ok: false, reason: "no_support_user" });
          continue;
        }

        const { error: insErr } = await admin.from("ticket_messages").insert({
          ticket_id: ticket.id,
          sender_id: botId,
          sender_role: "support",
          message: reply.text,
          is_ai: true,
        });
        if (insErr) {
          results.push({ ticketId: ticket.id, ok: false, reason: insErr.message });
          continue;
        }

        await admin
          .from("support_tickets")
          .update({ status: "in_progress", updated_at: new Date().toISOString() })
          .eq("id", ticket.id);

        processed += 1;
        results.push({ ticketId: ticket.id, ok: true });
      }

      return new Response(JSON.stringify({ ok: true, processed, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ticketId || !action) {
      return new Response(JSON.stringify({ error: "ticketId and action required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ticket } = await admin
      .from("support_tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle();
    if (!ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "suggest_reply" || action === "send_reply") {
      let replyText = providedReply;
      let replyStatus = 200;
      let replyError: string | undefined;

      if (!replyText) {
        const reply = await buildReplyForTicket(admin, AI_GATEWAY_API_KEY!, ticket, false, preferCheap);
        replyText = reply.text;
        replyStatus = reply.status;
        replyError = reply.error;
      }

      if (!replyText) {
        const status = replyStatus === 429 || replyStatus === 402 ? replyStatus : 500;
        return new Response(
          JSON.stringify({
            error: replyStatus === 429
              ? "Πολλά αιτήματα, προσπαθήστε ξανά σε λίγο."
              : replyStatus === 402
                ? "Δεν υπάρχουν διαθέσιμα credits AI."
                : replyError || "AI gateway error",
          }),
          { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (action === "send_reply") {
        if (!callerId) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error: insErr } = await admin.from("ticket_messages").insert({
          ticket_id: ticketId,
          sender_id: callerId,
          sender_role: callerRole === "admin" ? "admin" : "support",
          message: replyText,
          is_ai: true,
        });
        if (insErr) {
          return new Response(JSON.stringify({ error: insErr.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (ticket.status === "open") {
          await admin
            .from("support_tickets")
            .update({ status: "in_progress", updated_at: new Date().toISOString() })
            .eq("id", ticketId);
        }
      }

      return new Response(JSON.stringify({ result: replyText, action, sent: action === "send_reply" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ctx = await loadTicketContext(admin, ticket);

    let systemPrompt = "";
    let userPrompt = "";
    switch (action) {
      case "summarize":
        systemPrompt =
          "Συνοψίζεις tickets υποστήριξης στα ελληνικά. 2-3 προτάσεις max. Τόνισε το πρόβλημα, τι έχει γίνει, και τι χρειάζεται.";
        userPrompt = ctx;
        break;
      case "triage":
        systemPrompt =
          'Είσαι triage AI. Επιστρέφεις μόνο JSON: {"priority":"low|normal|high|sos","suggested_status":"open|in_progress|resolved","reason":"σύντομη αιτιολόγηση στα ελληνικά","next_action":"τι πρέπει να κάνει ο agent"}. sos = ατύχημα/έκτακτο. high = πελάτης περιμένει/πληρωμή. normal = app/όχημα. low = ερώτηση.';
        userPrompt = ctx;
        break;
      case "custom":
        systemPrompt =
          "Είσαι βοηθός υποστήριξης Fresh Delivery. Απαντάς στα ελληνικά, σύντομα και πρακτικά.";
        userPrompt = `${ctx}\n\nΕρώτηση από τον agent: ${customPrompt || "Βοήθησέ με"}`;
        break;
      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const ai = await callAi(AI_GATEWAY_API_KEY, systemPrompt, userPrompt, preferCheap);
    if (ai.status === 429) {
      return new Response(
        JSON.stringify({ error: "Πολλά αιτήματα, προσπαθήστε ξανά σε λίγο." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (ai.status === 402) {
      return new Response(
        JSON.stringify({ error: "Δεν υπάρχουν διαθέσιμα credits AI." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (ai.status !== 200) {
      console.error("AI gateway error", ai.status, ai.errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional: apply triage priorities when requested
    if (action === "triage" && body?.apply === true) {
      try {
        const cleaned = ai.content.replace(/```json\n?|```/g, "").trim();
        const triage = JSON.parse(cleaned);
        const priority = mapTriagePriority(triage.priority);
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (priority) patch.priority = priority;
        if (triage.suggested_status && ["open", "in_progress", "resolved"].includes(triage.suggested_status)) {
          patch.status = triage.suggested_status;
        }
        await admin.from("support_tickets").update(patch).eq("id", ticketId);
      } catch { /* ignore bad JSON */ }
    }

    return new Response(JSON.stringify({ result: ai.content, action }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("support-ai error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function loadTicketContext(admin: ReturnType<typeof createClient>, ticket: any): Promise<string> {
  const { data: messages } = await admin
    .from("ticket_messages")
    .select("sender_role, message, is_ai, created_at")
    .eq("ticket_id", ticket.id)
    .order("created_at", { ascending: true });

  let profileName = "";
  let profilePhone = "";
  const profileUserId = ticket.requester_id || ticket.driver_id;
  if (profileUserId) {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", profileUserId)
      .maybeSingle();
    profileName = profile?.full_name ?? "";
    profilePhone = profile?.phone ?? "";
  }

  let order: any = null;
  if (ticket.order_id) {
    const { data } = await admin
      .from("orders")
      .select("id, status, delivery_address, total_amount, distance_km, created_at")
      .eq("id", ticket.order_id)
      .maybeSingle();
    order = data;
  }

  const { data: canned } = await admin
    .from("canned_replies")
    .select("label, body, category")
    .order("sort_order", { ascending: true })
    .limit(12);

  const cannedBlock = (canned ?? [])
    .map((c: any) => `- [${c.category || "general"}] ${c.label}: ${c.body}`)
    .join("\n");

  const conversation =
    messages?.map((m: any) => `[${m.sender_role}${m.is_ai ? "/ai" : ""}] ${m.message}`).join("\n") ||
    "(καμία συνομιλία ακόμα)";

  return `
ΠΛΗΡΟΦΟΡΙΕΣ TICKET:
- Κατηγορία: ${ticket.category}
- Προτεραιότητα: ${ticket.priority}
- Κατάσταση: ${ticket.status}
- Ρόλος αιτούντος: ${ticket.requester_role || "driver"}
- Περιγραφή: ${ticket.description || "(καμία)"}
- Δημιουργήθηκε: ${ticket.created_at}
- Χρήστης: ${profileName || profileUserId || "—"} ${profilePhone ? `(${profilePhone})` : ""}
${order ? `- Σχετική παραγγελία: #${String(order.id).slice(0, 8)} | status=${order.status} | διεύθυνση=${order.delivery_address} | €${order.total_amount} | km=${order.distance_km}` : ""}

${cannedBlock ? `ΈΤΟΙΜΕΣ ΑΠΑΝΤΗΣΕΙΣ (αν ταιριάζουν, βάλε πάνω τους):\n${cannedBlock}\n` : ""}
ΣΥΝΟΜΙΛΙΑ ΜΕΧΡΙ ΤΩΡΑ:
${conversation}
`.trim();
}

async function buildReplyForTicket(
  admin: ReturnType<typeof createClient>,
  apiKey: string,
  ticket: any,
  autoMode: boolean,
  cheap: boolean,
): Promise<{ text: string; status: number; error?: string }> {
  const ctx = await loadTicketContext(admin, ticket);
  const who = requesterLabel(ticket.requester_role);
  const systemPrompt = autoMode
    ? `Είσαι AI πρώτη γραμμή υποστήριξης Fresh Delivery (delivery Ioannina). Γράφεις στα ΕΛΛΗΝΙΚΑ προς τον/την ${who}.
Κανόνες:
- Σύντομο (2-5 προτάσεις), ευγενικό, πρακτικό.
- ΜΗΝ υπόσχεσαι επιστροφή χρημάτων, αποζημίωση ή ακύρωση χρέωσης.
- ΜΗΝ ισχυρίζεσαι ότι είσαι άνθρωπος· μπορείς να πεις ότι είσαι βοηθός AI και ότι agent θα συνεχίσει αν χρειαστεί.
- Για επείγον/ατύχημα ζήτα άμεσα τηλέφωνο και σήμανε ότι θα ειδοποιηθεί agent.
- ΜΟΝΟ το κείμενο της απάντησης.`
    : `Είσαι έμπειρος agent υποστήριξης Fresh Delivery. Γράφεις στα ΕΛΛΗΝΙΚΑ, σύντομες, ευγενικές, επαγγελματικές απαντήσεις προς τον/την ${who}.
Δίνεις πρακτικά βήματα, ζητάς διευκρινίσεις όταν χρειάζεται. Δεν υπόσχεσαι αποζημιώσεις ή επιστροφές χωρίς admin.
ΜΟΝΟ το κείμενο της απάντησης, χωρίς εισαγωγές ή σχόλια.`;

  const userPrompt = `${ctx}\n\nΓράψε την επόμενη απάντηση προς τον/την ${who}.`;
  const ai = await callAi(apiKey, systemPrompt, userPrompt, cheap);
  if (ai.status !== 200) {
    return {
      text: "",
      status: ai.status,
      error: ai.status === 429
        ? "rate_limited"
        : ai.status === 402
          ? "no_credits"
          : "ai_error",
    };
  }
  return { text: ai.content, status: 200 };
}
