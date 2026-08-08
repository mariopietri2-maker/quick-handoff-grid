import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_GUARDRAILS,
  chargeBudget,
  effective,
  getUsageToday,
  isBudgetExceeded,
  isSoftThrottled,
  loadGuardrails,
  resetUsageMeter,
  saveGuardrails,
  tryConsumeAiCall,
  getAiCallsToday,
  resetAiCounter,
} from '@/lib/cost-guardrails';

describe('cost-guardrails settings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when nothing is stored', () => {
    expect(loadGuardrails()).toEqual(DEFAULT_GUARDRAILS);
  });

  it('merges partial saves over the defaults and persists', () => {
    const g = saveGuardrails({ aiDailyCallCap: 100, panicMode: true });
    expect(g.aiDailyCallCap).toBe(100);
    expect(g.panicMode).toBe(true);
    expect(g.pushNotificationsEnabled).toBe(true); // default untouched
    expect(loadGuardrails().aiDailyCallCap).toBe(100);
  });
});

describe('cost-guardrails budget meter', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUsageMeter();
  });

  it('starts at zero spend', () => {
    expect(getUsageToday().total).toBe(0);
    expect(getUsageToday().buckets).toEqual({ ai: 0, db: 0, realtime: 0, storage: 0 });
  });

  it('accumulates charges across buckets', () => {
    chargeBudget('ai', 0.01);
    chargeBudget('db', 0.0001);
    chargeBudget('realtime', 0.00002);
    const u = getUsageToday();
    expect(u.buckets.ai).toBeCloseTo(0.01, 5);
    expect(u.buckets.db).toBeCloseTo(0.0001, 5);
    expect(u.buckets.realtime).toBeCloseTo(0.00002, 5);
    expect(u.total).toBeCloseTo(0.01012, 5);
  });

  it('ignores non-positive charges', () => {
    chargeBudget('ai', 0);
    chargeBudget('ai', -1);
    expect(getUsageToday().total).toBe(0);
  });

  it('resets the meter', () => {
    chargeBudget('storage', 0.5);
    resetUsageMeter();
    expect(getUsageToday().total).toBe(0);
  });

  it('isBudgetExceeded trips at the daily cap', () => {
    saveGuardrails({ dailyBudgetCredits: 0.02 });
    chargeBudget('ai', 0.01);
    expect(isBudgetExceeded()).toBe(false);
    chargeBudget('ai', 0.01);
    expect(isBudgetExceeded()).toBe(true);
  });

  it('isSoftThrottled is true at/above the soft pct but below 100', () => {
    saveGuardrails({ dailyBudgetCredits: 4 });
    expect(isSoftThrottled()).toBe(false); // 0%
    chargeBudget('ai', 3); // 75%
    expect(isSoftThrottled()).toBe(true);
    chargeBudget('ai', 1); // 100% → panic territory, not soft throttle
    expect(isSoftThrottled()).toBe(false);
    expect(isBudgetExceeded()).toBe(true);
  });
});

describe('cost-guardrails effective flags', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUsageMeter();
  });

  it('kills all optional paid features under panic mode', () => {
    const g = effective({ ...DEFAULT_GUARDRAILS, panicMode: true });
    expect(g.panicMode).toBe(true);
    expect(g.aiEnabled).toBe(false);
    expect(g.realtimeLocationsEnabled).toBe(false);
    expect(g.pushNotificationsEnabled).toBe(false);
    expect(g.storageUploadsEnabled).toBe(false);
  });

  it('auto-panics when the budget trips and autoPanicOnBudget is on', () => {
    saveGuardrails({ dailyBudgetCredits: 0.01 });
    chargeBudget('ai', 0.01);
    const g = effective(loadGuardrails());
    expect(g.panicMode).toBe(true);
    expect(g.aiEnabled).toBe(false);
  });

  it('soft-throttles AI + realtime but keeps push and storage', () => {
    saveGuardrails({ dailyBudgetCredits: 4 });
    chargeBudget('db', 3); // 75%
    const g = effective(loadGuardrails());
    expect(g.panicMode).toBe(false);
    expect(g.aiEnabled).toBe(false);
    expect(g.realtimeLocationsEnabled).toBe(false);
    expect(g.aiPreferCheapModel).toBe(true);
    expect(g.pushNotificationsEnabled).toBe(true);
    expect(g.storageUploadsEnabled).toBe(true);
  });

  it('passes settings through untouched when under the soft threshold', () => {
    const g = loadGuardrails();
    expect(effective(g)).toBe(g); // same reference, no copy made
  });
});

describe('cost-guardrails AI call limiter', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUsageMeter();
    resetAiCounter();
  });

  it('consumes calls and charges the budget', () => {
    const r = tryConsumeAiCall();
    expect(r.ok).toBe(true);
    expect(getAiCallsToday()).toBe(1);
    expect(getUsageToday().buckets.ai).toBeCloseTo(0.01, 5);
  });

  it('blocks calls once the daily cap is reached', () => {
    saveGuardrails({ aiDailyCallCap: 2 });
    expect(tryConsumeAiCall().ok).toBe(true);
    expect(tryConsumeAiCall().ok).toBe(true);
    const blocked = tryConsumeAiCall();
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toContain('2');
    expect(getAiCallsToday()).toBe(2);
  });

  it('blocks calls when AI is disabled by panic mode', () => {
    saveGuardrails({ panicMode: true });
    const r = tryConsumeAiCall();
    expect(r.ok).toBe(false);
    expect(getAiCallsToday()).toBe(0);
  });
});
