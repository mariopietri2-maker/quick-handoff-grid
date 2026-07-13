// Admin-only: create a disposable test customer account.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getAuthedUser, unauthorized } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getAuthedUser(req);
  if (!user?.isAdmin) return unauthorized(corsHeaders);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: { role?: string } = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const role = body.role === "driver" || body.role === "store" ? body.role : "customer";

  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const email = `test-${role}-${stamp}@freshdelivery.test`;
  const password = `Test!${stamp}${Math.random().toString(36).slice(2, 6)}`;
  const fullName = `Test ${role.charAt(0).toUpperCase() + role.slice(1)} ${stamp.slice(-4)}`;

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !created.user) {
    return new Response(JSON.stringify({ error: error?.message ?? "create failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = created.user.id;

  // Make sure profile + role exist (a trigger may already do this; upsert anyway).
  await admin.from("profiles").upsert(
    { user_id: userId, full_name: fullName, role },
    { onConflict: "user_id" },
  );
  await admin.from("user_roles").upsert(
    { user_id: userId, role },
    { onConflict: "user_id,role" },
  );

  // For drivers: activate profile + create state + seed a GPS location so
  // the driver is immediately visible to the dispatch engine.
  if (role === "driver") {
    await admin.from("driver_profiles").upsert(
      { user_id: userId, is_active: true, vehicle_type: "motorcycle" },
      { onConflict: "user_id" },
    );
    await admin.from("driver_state").upsert(
      { driver_id: userId, on_break: false },
      { onConflict: "driver_id" },
    );
    // Place near the first store's coordinates if available, else default.
    const { data: store } = await admin
      .from("stores")
      .select("latitude, longitude")
      .not("latitude", "is", null)
      .limit(1)
      .maybeSingle();
    const lat = store?.latitude ?? 39.6698;
    const lng = store?.longitude ?? 20.8528;
    await admin.from("driver_locations").upsert(
      { driver_id: userId, latitude: lat, longitude: lng, updated_at: new Date().toISOString() },
      { onConflict: "driver_id" },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, email, password, user_id: userId, role }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
