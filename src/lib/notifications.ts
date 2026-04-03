// Notification utilities for the store app

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/**
 * Play a notification chime using the Web Audio API (no external files needed).
 * Three ascending tones that sound like a classic order bell.
 */
export function playOrderSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5 — major chord
    const duration = 0.15;
    const gap = 0.12;

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, now + i * (duration + gap));
      gain.gain.linearRampToValueAtTime(0.3, now + i * (duration + gap) + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * (duration + gap) + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * (duration + gap));
      osc.stop(now + i * (duration + gap) + duration + 0.05);
    });
  } catch (e) {
    console.warn('Could not play notification sound:', e);
  }
}

/**
 * Request browser notification permission.
 * Returns true if granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

/**
 * Show a browser notification for a new order.
 */
export function showOrderNotification(orderId: string, itemCount: number) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const notification = new Notification('🔔 New Order!', {
    body: `Order #${orderId.slice(0, 6)} — ${itemCount} item${itemCount !== 1 ? 's' : ''}`,
    icon: '/placeholder.svg',
    tag: `order-${orderId}`,
    requireInteraction: true,
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };

  // Auto-close after 30 seconds
  setTimeout(() => notification.close(), 30000);
}
