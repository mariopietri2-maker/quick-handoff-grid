// Shared helper: enqueue an alert into alert_outbox from an edge function.
// The RPC is granted to service_role, so any edge function can call it.

export interface EnqueueAlertInput {
  event_type: string;
  severity: 'info' | 'warn' | 'error' | 'critical';
  title: string;
  body?: string;
  data?: Record<string, unknown> | null;
  dedupe_key?: string;
  channel?: 'webhook' | 'slack';
}

export async function enqueueAlert(
  supabase: any,
  input: EnqueueAlertInput,
): Promise<boolean> {
  const { error } = await supabase.rpc('enqueue_alert', {
    p_event_type: input.event_type,
    p_severity: input.severity,
    p_title: input.title,
    p_body: input.body ?? null,
    p_data: input.data ?? null,
    p_dedupe_key: input.dedupe_key ?? null,
    p_channel: input.channel ?? 'webhook',
  });
  if (error) console.warn('enqueueAlert failed:', error.message);
  return !error;
}
