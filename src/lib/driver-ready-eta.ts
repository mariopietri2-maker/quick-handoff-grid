/** Shared ready-ETA helpers for driver offer / map / delivery UI. */

export function minutesUntilReady(predictedReadyAt: string | null | undefined, now = Date.now()): number | null {
  if (!predictedReadyAt) return null;
  const t = new Date(predictedReadyAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.ceil((t - now) / 60_000));
}

export function readyEtaLabel(
  predictedReadyAt: string | null | undefined,
  orderStatus?: string | null,
  estimatedPrepMin?: number | null,
): string {
  if (orderStatus === 'ready') return 'Έτοιμη';
  const mins = minutesUntilReady(predictedReadyAt);
  if (mins != null) {
    if (mins <= 0) return 'Έτοιμη όπου να ναι';
    return `Έτοιμη σε ~${mins}′`;
  }
  if (estimatedPrepMin != null && estimatedPrepMin > 0) {
    return `Prep ~${estimatedPrepMin}′`;
  }
  return '';
}

export function readyEtaShortTag(
  predictedReadyAt: string | null | undefined,
  orderStatus?: string | null,
  estimatedPrepMin?: number | null,
): { text: string; ready: boolean } | null {
  if (orderStatus === 'ready') return { text: 'Έτοιμη', ready: true };
  const mins = minutesUntilReady(predictedReadyAt);
  if (mins != null) {
    if (mins <= 0) return { text: 'Έτοιμη', ready: true };
    return { text: `~${mins}′`, ready: false };
  }
  if (estimatedPrepMin != null && estimatedPrepMin > 0) {
    return { text: `~${estimatedPrepMin}′`, ready: false };
  }
  return null;
}
