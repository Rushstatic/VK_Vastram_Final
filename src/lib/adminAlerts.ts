/**
 * Admin alert helpers: a short chime and vibration for new orders while the admin page is open.
 * Browsers only allow sound after the admin has interacted with the page (tapped anything once).
 */
let sharedContext: AudioContext | null = null;

export function playOrderChime(): void {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    sharedContext = sharedContext || new Ctx();
    const ctx = sharedContext;
    if (ctx.state === 'suspended') void ctx.resume();
    [880, 1174.66, 1318.5].forEach((frequency, index) => {
      const start = ctx.currentTime + index * 0.18;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.15, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.25);
    });
  } catch {
    // Audio not available on this device: the on-screen alert still shows.
  }
}

export function vibrateForOrder(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([300, 120, 300, 120, 500]);
    }
  } catch {
    // ignore
  }
}

/** Makes the admin page installable as an app (manifest + iPhone home-screen tags). */
export function ensureAdminAppInstallTags(): void {
  const add = (selector: string, create: () => HTMLElement) => {
    if (!document.head.querySelector(selector)) document.head.appendChild(create());
  };
  add('link[rel="manifest"]', () => {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/admin.webmanifest';
    return link;
  });
  add('meta[name="apple-mobile-web-app-capable"]', () => {
    const meta = document.createElement('meta');
    meta.name = 'apple-mobile-web-app-capable';
    meta.content = 'yes';
    return meta;
  });
  add('meta[name="apple-mobile-web-app-title"]', () => {
    const meta = document.createElement('meta');
    meta.name = 'apple-mobile-web-app-title';
    meta.content = 'VK Admin';
    return meta;
  });
  add('link[rel="apple-touch-icon"][data-admin]', () => {
    const link = document.createElement('link');
    link.rel = 'apple-touch-icon';
    link.href = '/admin-icon-192.png';
    link.setAttribute('data-admin', 'true');
    return link;
  });
}
