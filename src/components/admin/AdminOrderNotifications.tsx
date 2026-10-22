import React, { useState } from 'react';
import { BellRing, BellOff, Volume2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { playOrderChime } from '../../lib/adminAlerts';

function decodeVapidKey(base64: string): Uint8Array {
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export const AdminOrderNotifications: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [enabled, setEnabled] = useState(false);

  const authHeader = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Your admin session has expired. Sign in again.');
    return { Authorization: `Bearer ${token}` };
  };

  const enable = async () => {
    setBusy(true); setMessage('');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) throw new Error('Push notifications are not supported by this browser. Enable admin email alerts as a fallback.');
      if (!window.isSecureContext) throw new Error('Push notifications require HTTPS (localhost is supported for development).');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Notification permission was not granted. Enable it in browser settings.');
      const configRes = await fetch('/api/admin/notifications/push-config');
      const config = await configRes.json();
      if (!configRes.ok || !config.enabled || !config.publicKey) throw new Error('Admin push is not configured on the server yet.');
      const registration = await navigator.serviceWorker.register('/admin-sw.js', { scope: '/' });
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapidKey(config.publicKey).buffer as ArrayBuffer });
      const headers = await authHeader();
      const res = await fetch('/api/admin/notifications/push-subscription', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: subscription.toJSON() }) });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Could not save this device subscription.');
      setEnabled(true); setMessage('Admin order alerts are enabled on this device.');
    } catch (e: any) { setMessage(e?.message || 'Could not enable admin alerts.'); }
    finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true); setMessage('');
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const headers = await authHeader();
        await fetch('/api/admin/notifications/push-subscription', { method: 'DELETE', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        await subscription.unsubscribe();
      }
      setEnabled(false); setMessage('Admin push alerts disabled on this device.');
    } catch (e: any) { setMessage(e?.message || 'Could not disable admin alerts.'); }
    finally { setBusy(false); }
  };

  const testSound = () => {
    playOrderChime();
    setMessage('Previewed the VK VASTRAM alert sound. Custom sound only plays while this page is active and audio is permitted.');
  };

  return <div className="w-full max-w-lg rounded border border-[#B88E3E]/40 bg-[#FAF8F5] p-4 sm:p-5 space-y-3">
    <div className="flex items-start gap-3"><BellRing className="h-5 w-5 text-[#967029] mt-0.5"/><div className="min-w-0 flex-1"><h3 className="font-serif text-lg text-[#1C1917]">Admin order alerts</h3><p className="mt-1 text-sm text-[#57534E]">Receive new-order and order-lifecycle alerts on this device, including when the dashboard is closed if push is supported and enabled.</p></div></div>
    <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || enabled} onClick={enable} className="min-h-10 px-4 py-2 bg-[#1C1917] text-white text-sm disabled:opacity-50">{busy ? 'Please wait…' : enabled ? 'Push enabled' : 'Enable admin alerts'}</button><button type="button" disabled={busy} onClick={disable} className="min-h-10 px-4 py-2 border border-[#1C1917]/20 text-sm"><BellOff className="h-4 w-4 inline mr-1"/>Turn off</button><button type="button" onClick={testSound} className="min-h-10 px-4 py-2 border border-[#1C1917]/20 text-sm"><Volume2 className="h-4 w-4 inline mr-1"/>Test sound</button></div>
    {message && <p role="status" className="text-sm text-[#57534E] break-words">{message}</p>}
    <p className="text-xs text-[#78716C]">Email alerts are sent separately to ADMIN_NOTIFICATION_EMAIL. Operating systems control locked-screen notification sounds; this page cannot force a custom system sound.</p>
  </div>;
};
