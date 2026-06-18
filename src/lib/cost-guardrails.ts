// Cost guardrails — client-side kill switches & hard caps to prevent
// runaway Lovable Cloud / AI / Storage charges.
// Stored in localStorage, broadcast via 'storage' event + custom event
// so any tab/component reacts immediately.

import { useEffect, useState } from 'react';

export type CostGuardrails = {
  // Master panic switch — disables every non-essential paid service
  panicMode: boolean;
  // Lovable AI
  aiEnabled: boolean;
  aiDailyCallCap: number;          // hard cap on AI calls/day (client-tracked)
  aiPreferCheapModel: boolean;     // force flash-lite tier
  // Realtime / DB write volume
  realtimeLocationsEnabled: boolean;
  driverLocationIntervalSec: number; // raise to reduce writes
  pushNotificationsEnabled: boolean;
  // Storage
  storageUploadsEnabled: boolean;
  maxUploadMb: number;
  imageCompression: boolean;
};

export const DEFAULT_GUARDRAILS: CostGuardrails = {
  panicMode: false,
  aiEnabled: true,
  aiDailyCallCap: 500,
  aiPreferCheapModel: true,
  realtimeLocationsEnabled: true,
  driverLocationIntervalSec: 15,
  pushNotificationsEnabled: true,
  storageUploadsEnabled: true,
  maxUploadMb: 5,
  imageCompression: true,
};

const KEY = 'cost_guardrails_v1';
const EVT = 'cost-guardrails:changed';
const AI_COUNTER_KEY = 'cost_ai_counter_v1';

export function loadGuardrails(): CostGuardrails {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_GUARDRAILS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_GUARDRAILS;
}

export function saveGuardrails(next: Partial<CostGuardrails>): CostGuardrails {
  const merged = { ...loadGuardrails(), ...next };
  localStorage.setItem(KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent(EVT, { detail: merged }));
  return merged;
}

export function useGuardrails(): CostGuardrails {
  const [g, setG] = useState<CostGuardrails>(loadGuardrails);
  useEffect(() => {
    const onChange = () => setG(loadGuardrails());
    window.addEventListener(EVT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);
  return g;
}

// Effective flags after applying panicMode overrides.
export function effective(g: CostGuardrails) {
  if (g.panicMode) {
    return {
      ...g,
      aiEnabled: false,
      realtimeLocationsEnabled: false,
      pushNotificationsEnabled: false,
      storageUploadsEnabled: false,
    };
  }
  return g;
}

// --- AI call counter (per UTC day) ---
type Counter = { day: string; count: number };
function todayKey() { return new Date().toISOString().slice(0, 10); }

export function getAiCallsToday(): number {
  try {
    const raw = localStorage.getItem(AI_COUNTER_KEY);
    if (!raw) return 0;
    const c: Counter = JSON.parse(raw);
    return c.day === todayKey() ? c.count : 0;
  } catch { return 0; }
}

/** Call before invoking AI. Returns false if blocked. */
export function tryConsumeAiCall(): { ok: boolean; reason?: string } {
  const g = effective(loadGuardrails());
  if (!g.aiEnabled) return { ok: false, reason: 'AI απενεργοποιημένο από τα Cost Guardrails' };
  const used = getAiCallsToday();
  if (used >= g.aiDailyCallCap) {
    return { ok: false, reason: `Έφτασες το όριο ${g.aiDailyCallCap} κλήσεων/ημέρα` };
  }
  const next: Counter = { day: todayKey(), count: used + 1 };
  localStorage.setItem(AI_COUNTER_KEY, JSON.stringify(next));
  return { ok: true };
}

export function resetAiCounter() {
  localStorage.removeItem(AI_COUNTER_KEY);
}
