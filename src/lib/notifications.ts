// Notification utilities used across the apps (store, driver, customer).
import { showOsNotification, ensureNotificationPermission } from './push-notifications';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function playTones(frequencies: number[], type: OscillatorType = 'sine', duration = 0.15, gap = 0.12, gainPeak = 0.3) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const t0 = now + i * (duration + gap);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.05);
    });
  } catch (e) {
    console.warn('Could not play sound:', e);
  }
}

/**
 * Play a notification chime — random short melody for new store orders.
 */
export function playOrderSound() {
  const patterns: number[][] = [
    [523.25, 659.25, 783.99],       // C major
    [392.0, 523.25, 659.25],        // G → C → E
    [587.33, 739.99, 880.0],        // D major-ish
    [440.0, 554.37, 659.25],        // A → C# → E
    [349.23, 440.0, 523.25],        // F → A → C
    [659.25, 783.99, 987.77],       // E → G → B
  ];
  const freqs = patterns[Math.floor(Math.random() * patterns.length)]!;
  playTones(freqs);
}

/**
 * Play a driver delivery alert — two quick low tones (randomized pair).
 */
export function playDeliverySound() {
  const pairs: [number, number][] = [
    [440, 554.37],
    [392, 523.25],
    [349.23, 440],
    [493.88, 587.33],
  ];
  const [a, b] = pairs[Math.floor(Math.random() * pairs.length)]!;
  playTones([a, b], 'triangle', 0.18, 0.1, 0.35);
}

/**
 * Play a soft status-update chime — random short tone for customers.
 */
export function playStatusUpdateSound() {
  const tones = [784, 880, 698.46, 987.77, 659.25];
  const freq = tones[Math.floor(Math.random() * tones.length)]!;
  playTones([freq], 'sine', 0.18, 0, 0.18);
}

/**
 * Request notification permission. Returns true if granted.
 * Uses Capacitor LocalNotifications on native, web Notification API in browser.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  return ensureNotificationPermission();
}

/**
 * Show a browser notification for a new order (store).
 */
export function showOrderNotification(orderId: string, itemCount: number) {
  void showOsNotification({
    title: '🔔 Νέα Παραγγελία!',
    body: `Παραγγελία #${orderId.slice(0, 6)} — ${itemCount} προϊόν${itemCount !== 1 ? 'τα' : ''}`,
    tag: `order-${orderId}`,
    vibrate: true,
  });
}

/**
 * Show a browser notification for a new delivery offer (driver).
 */
export function showDeliveryNotification(estimatedPayout: number) {
  void showOsNotification({
    title: '📦 Νέα Παράδοση!',
    body: `Εκτιμώμενη αμοιβή: €${estimatedPayout.toFixed(2)} — Πάτα για προβολή`,
    tag: `delivery-${Date.now()}`,
    vibrate: true,
  });
}

/**
 * Customer-facing labels for order status push notifications.
 */
const customerStatusLabels: Record<string, { title: string; body: string }> = {
  accepted:  { title: '✅ Παραγγελία αποδεκτή', body: 'Το κατάστημα έλαβε την παραγγελία σου.' },
  preparing: { title: '👨‍🍳 Ετοιμάζεται',         body: 'Η παραγγελία σου ετοιμάζεται.' },
  ready:     { title: '📦 Έτοιμη για παραλαβή',  body: 'Έτοιμη — αναμένει τον οδηγό.' },
  picked_up: { title: '🛵 Ο οδηγός έρχεται!',     body: 'Ο οδηγός παρέλαβε την παραγγελία και είναι καθ’ οδόν προς εσένα.' },
  arrived:   { title: '🏪 Οδηγός στο κατάστημα',  body: 'Ο οδηγός έφτασε στο κατάστημα για παραλαβή.' },
  delivered: { title: '🎉 Παραδόθηκε',             body: 'Καλή σου όρεξη! Άφησε μια κριτική 💛' },
  cancelled: { title: '❌ Ακυρώθηκε',              body: 'Η παραγγελία σου ακυρώθηκε.' },
};

/**
 * Show a browser/OS notification for a customer order status update.
 * Returns true if a notification was shown.
 */
export function showOrderStatusNotification(orderId: string, status: string): boolean {
  const cfg = customerStatusLabels[status];
  if (!cfg) return false;
  void showOsNotification({
    title: cfg.title,
    body: `${cfg.body} (Παραγγελία #${orderId.slice(0, 6)})`,
    tag: `customer-order-${orderId}-${status}`,
    vibrate: status === 'picked_up' || status === 'delivered',
    channelId: 'customer-orders',
  });
  return true;
}

/** One-shot “driver is nearby” alert (proximity / ETA). */
export function showDriverArrivingNotification(orderId: string) {
  void showOsNotification({
    title: '📍 Ο οδηγός φτάνει!',
    body: `Ο οδηγός είναι κοντά σου. (Παραγγελία #${orderId.slice(0, 6)})`,
    tag: `customer-arriving-${orderId}`,
    vibrate: true,
    channelId: 'customer-orders',
  });
}
