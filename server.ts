import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';
import { invokeCheckedRpc, OrderSafetyError, validateOrderLines } from './server/orderSafety.ts';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
// Development identity/admin shortcuts must be explicitly opted into and can never run in production.
const allowDevelopmentAuth = !isProduction && process.env.ALLOW_DEV_AUTH === 'true';
const PORT = Number(process.env.PORT) || 3000;

// Configuration variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const useSupabase = Boolean(
  SUPABASE_URL &&
  !SUPABASE_URL.includes('example.com') &&
  !SUPABASE_URL.includes('your-project') &&
  !SUPABASE_URL.includes('dummy')
);

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
// Online checkout stock hold. While a customer is paying, the item is only RESERVED (stock is
// not deducted). If payment is not completed within this window the hold is released and the
// unpaid order is cancelled automatically. COD orders are confirmed immediately and are not affected.
const CHECKOUT_HOLD_MINUTES = Math.min(30, Math.max(5, Number(process.env.CHECKOUT_HOLD_MINUTES) || 10));
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

// In production, privileged server-side database operations must never fall back to
// the public anon key. Development may use the anon key for safe local/read-only work.
const supabaseServerKey = SUPABASE_SERVICE_ROLE_KEY || (!isProduction ? SUPABASE_ANON_KEY : '');
const supabaseAdmin: SupabaseClient | null =
  SUPABASE_URL && supabaseServerKey
    ? createClient(SUPABASE_URL, supabaseServerKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

const db = useSupabase ? supabaseAdmin : null;

/** Admin-only best-effort push + email. Delivery failures never roll back an order commit. */
async function dispatchAdminOrderAlert(orderId: string, eventType: 'new_order' | 'status_update' | 'refund_required', status?: string): Promise<void> {
  if (!db) return;
  try {
    const { data: order, error } = await db.from('orders').select('id,order_number,total_amount,currency,payment_status,order_status,customer_name,customer_email').eq('id', orderId).maybeSingle();
    if (error || !order) return;
    const orderNumber = String(order.order_number || order.id);
    const isNew = eventType === 'new_order';
    let paymentMethod = 'ORDER';
    if (isNew) {
      const { data: payment } = await db.from('payments').select('provider,method').eq('order_id', orderId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      paymentMethod = String(payment?.method || payment?.provider || 'ORDER').toUpperCase();
    }
    const isRefundAlert = eventType === 'refund_required';
    const title = isRefundAlert ? 'ACTION REQUIRED: VK VASTRAM refund review' : (isNew ? 'New VK VASTRAM order' : 'VK VASTRAM order updated');
    const body = isNew ? `${orderNumber} · ₹${Number(order.total_amount || 0).toLocaleString('en-IN')} · ${paymentMethod}` : `${orderNumber} · ${String(status || order.order_status || 'status updated').replace(/_/g, ' ')}`;
    const payload = JSON.stringify({ title, body, url: '/admin', tag: `vkv-${order.id}-${eventType}-${status || ''}` });
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      try {
        webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support@vkvastram.in', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
        const { data: subs } = await db.from('admin_push_subscriptions').select('id,endpoint,p256dh,auth').eq('enabled', true).limit(100);
        for (const sub of subs || []) {
          try { await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload); }
          catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await db.from('admin_push_subscriptions').update({ enabled: false, updated_at: new Date().toISOString() }).eq('id', sub.id); }
        }
      } catch { console.warn('[admin-notifications] push delivery attempt failed'); }
    }
    const to = (eventType === 'new_order' || isRefundAlert) ? String(process.env.ADMIN_NOTIFICATION_EMAIL || '').trim() : '';
    if (to && process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
      const safe = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c] || c));
      try {
        const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [to], subject: `${title}: ${orderNumber}`, html: `<div style="font-family:Arial,sans-serif"><h2>${safe(title)}</h2><p>${safe(body)}</p><p>Customer: ${safe(order.customer_name || 'Customer')}</p><p>Payment status: ${safe(order.payment_status)}</p><p><a href="${String(process.env.SITE_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')}/admin">Open VK VASTRAM Admin</a></p></div>` }) });
        if (!response.ok) { const detail = await response.text().catch(() => ''); console.error(`[admin-notifications] Resend rejected email (${response.status}): ${detail.slice(0, 500)}`); }
        else { console.info(`[admin-notifications] email accepted by Resend for order ${orderNumber}`); }
      } catch (error) { console.error('[admin-notifications] email delivery request failed', error instanceof Error ? error.message : 'unknown error'); }
    }
  } catch { console.warn('[admin-notifications] alert dispatch failed; order state remains committed'); }
}




/** Customer order email: order summary/invoice details plus a direct link to the tracking page. */
async function dispatchCustomerOrderEmail(orderId: string): Promise<void> {
  if (!db || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return;
  const baseUrl = String(process.env.SITE_URL || process.env.APP_URL || '').replace(/\/$/, '');
  if (!baseUrl) return;
  try {
    const { data: order, error } = await db.from('orders').select('id,order_number,customer_name,customer_email,total_amount,subtotal,discount_amount,shipping_amount,tax_amount,currency,payment_status,order_status,created_at,items:order_items(product_name_snapshot,quantity,price_snapshot,total_amount)').eq('id',orderId).maybeSingle();
    if (error || !order?.customer_email) return;
    const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c));
    const orderNo = String(order.order_number || order.id);
    const trackingUrl = `${baseUrl}/track-order?orderId=${encodeURIComponent(orderNo)}`;
    const items = (order.items || []).map((item:any) => `<tr><td style="padding:10px;border-bottom:1px solid #eee">${esc(item.product_name_snapshot || 'VK VASTRAM product')} × ${Number(item.quantity||1)}</td><td style="padding:10px;border-bottom:1px solid #eee;text-align:right">₹${Number(item.total_amount ?? (Number(item.price_snapshot||0)*Number(item.quantity||1))).toLocaleString('en-IN')}</td></tr>`).join('');
    const amount = (label:string,value:unknown) => `<tr><td style="padding:7px 10px;color:#57534e">${label}</td><td style="padding:7px 10px;text-align:right">₹${Number(value||0).toLocaleString('en-IN')}</td></tr>`;
    const html = `<div style="margin:0 auto;max-width:640px;background:#faf8f5;padding:28px;font-family:Arial,sans-serif;color:#1c1917"><div style="text-align:center;padding:22px 12px"><p style="letter-spacing:4px;color:#b88e3e;font-size:11px">VK VASTRAM</p><h1 style="font-family:Georgia,serif;font-weight:normal">Thank you for your order.</h1><p style="color:#57534e">Your order ${esc(orderNo)} has been received.</p></div><div style="background:#fff;padding:22px;border:1px solid #e7dfd2"><h2 style="font-family:Georgia,serif;font-weight:normal">Order summary / invoice details</h2><p>Order date: ${esc(new Date(order.created_at).toLocaleDateString('en-IN'))}<br>Payment status: ${esc(order.payment_status)}<br>Order status: ${esc(order.order_status)}</p><table style="width:100%;border-collapse:collapse">${items}${amount('Subtotal',order.subtotal)}${amount('Discount',order.discount_amount)}${amount('Shipping',order.shipping_amount)}${amount('Tax',order.tax_amount)}${amount('Total',order.total_amount)}</table><p style="font-size:12px;color:#78716c">This email contains your order and tax summary; your official tax invoice remains available through the order records/invoice workflow.</p><p style="text-align:center;margin:28px 0"><a href="${trackingUrl}" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:14px 24px">TRACK YOUR ORDER</a></p><p style="font-size:12px;color:#78716c">For privacy, the tracking page asks for your order ID and checkout email.</p></div><p style="text-align:center;font-size:12px;color:#78716c;padding:18px">With care, VK VASTRAM</p></div>`;
    const response = await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESEND_FROM_EMAIL,to:[order.customer_email],subject:`Order received · ${orderNo} | VK VASTRAM`,html})});
    if(!response.ok) console.error(`[customer-order-email] Resend rejected email (${response.status}) for order ${orderNo}`); else console.info(`[customer-order-email] accepted for order ${orderNo}`);
  } catch (e) { console.warn('[customer-order-email] dispatch failed; order remains committed'); }
}

/**
 * Admin alert + customer email are sent only when an order is CONFIRMED:
 * Cash on Delivery at creation, online orders once the payment is captured.
 * An online order that is merely waiting for payment never notifies anyone.
 */
const confirmedOrderNotified = new Set<string>();
async function notifyOrderConfirmed(orderId: string): Promise<void> {
  if (!orderId || confirmedOrderNotified.has(orderId)) return;
  confirmedOrderNotified.add(orderId);
  if (confirmedOrderNotified.size > 5000) {
    const oldest = confirmedOrderNotified.values().next().value;
    if (oldest) confirmedOrderNotified.delete(oldest);
  }
  void dispatchAdminOrderAlert(orderId, 'new_order');
  void dispatchCustomerOrderEmail(orderId);
}

/** True when the order's payment was already captured (so a repeat verify/webhook must not notify again). */
async function isOrderPaymentCaptured(orderId: string): Promise<boolean> {
  if (!db || !orderId) return false;
  try {
    const { data } = await db.from('orders').select('payment_status').eq('id', orderId).maybeSingle();
    return ['captured', 'paid'].includes(String(data?.payment_status || '').toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Releases the stock hold of unpaid online orders whose checkout window ended, and cancels those
 * orders with payment_status = failed. Runs every minute (see startServer) and just before a new
 * order is created, so a skipped payment can never keep a saree "sold out".
 */
let lastUnpaidSweepAt = 0;
let unpaidSweepInFlight = false;
let unpaidSweepWarned = false;
async function sweepUnpaidOrders(force = false): Promise<void> {
  if (!db || unpaidSweepInFlight) return;
  const now = Date.now();
  if (!force && now - lastUnpaidSweepAt < 20_000) return;
  unpaidSweepInFlight = true;
  lastUnpaidSweepAt = now;
  try {
    const { data, error } = await (db as any).rpc('reconcile_expired_reservations');
    if (error) {
      if (!unpaidSweepWarned) {
        unpaidSweepWarned = true;
        console.warn('[checkout-sweeper] Could not release expired holds. Has migration 20261019000002 been applied?', error.message);
      }
      return;
    }
    const released = Number((data as any)?.expired_count ?? (data as any)?.reconciled_count ?? 0);
    if (released > 0) console.info(`[checkout-sweeper] Released ${released} unpaid online order(s) and their stock hold.`);
  } catch (err: any) {
    if (!unpaidSweepWarned) {
      unpaidSweepWarned = true;
      console.warn('[checkout-sweeper] Sweep failed:', err?.message || err);
    }
  } finally {
    unpaidSweepInFlight = false;
  }
}

/** Sends queued restock notices when Resend is configured; never fails inventory commits. */
async function dispatchReadyBackInStockEmails(variantId: string): Promise<void> {
  if (!db || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL || !(process.env.SITE_URL || process.env.APP_URL)) return;
  try {
    const { data: variant, error: variantError } = await db.from('product_variants')
      .select('id,product_id,variant_name,sku,products(name,slug)')
      .eq('id', variantId).maybeSingle();
    if (variantError || !variant) return;
    const productRecord = Array.isArray((variant as any).products) ? (variant as any).products[0] : (variant as any).products;
    const productName = String(productRecord?.name || 'VK VASTRAM product');
    const baseUrl = String(process.env.SITE_URL || process.env.APP_URL || '').replace(/\/$/, '');
    const productUrl = baseUrl && productRecord?.slug ? `${baseUrl}/product/${encodeURIComponent(productRecord.slug)}` : baseUrl;
    const { data: subscriptions, error: subscriptionError } = await db.from('back_in_stock_subscriptions')
      .select('id,email').eq('product_variant_id', variantId).eq('status', 'ready').limit(100);
    if (subscriptionError || !subscriptions?.length) return;
    for (const subscription of subscriptions) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL,
            to: [subscription.email],
            subject: `${productName} is back in stock | VK VASTRAM`,
            html: `<div style="font-family:Georgia,serif;color:#1c1917;max-width:600px;margin:24px auto;line-height:1.6"><h1 style="color:#78281f;font-weight:normal">A drape you loved is available again.</h1><p><strong>${productName.replace(/[&<>"']/g, (c: string) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c))}</strong>${variant.variant_name ? ` — ${String(variant.variant_name).replace(/[&<>"']/g, '')}` : ''} is back in stock.</p>${productUrl ? `<p><a href="${productUrl}" style="display:inline-block;background:#1c1917;color:#fff;padding:12px 18px;text-decoration:none">View product</a></p>` : ''}<p style="font-size:12px;color:#78716c">You received this because you requested a restock notification from VK VASTRAM.</p></div>`
          })
        });
        if (!response.ok) continue;
        await db.from('back_in_stock_subscriptions').update({ status: 'notified', notified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', subscription.id).eq('status', 'ready');
      } catch (emailError) {
        console.warn('[back-in-stock] email delivery failed for queued subscription');
      }
    }
  } catch (error) {
    console.warn('[back-in-stock] unable to dispatch ready subscriptions');
  }
}


// In-memory processed webhook cache for fast lookup optimization
const processedWebhookEventIds = new Set<string>();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    email_confirmed_at?: string | null;
    confirmed_at?: string | null;
    user_metadata?: any;
    app_metadata?: any;
  };
  rawBody?: Buffer;
}

/**
 * Timing-safe string comparison to prevent side-channel timing attacks
 */
function timingSafeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Cryptographic SHA-256 hash helper for guest access tokens
 */
function hashGuestToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Extract guest token from request headers or legacy request body; never use query strings
 */
function extractGuestToken(req: Request): string | null {
  const headerToken =
    (req.headers['x-guest-token'] as string) ||
    (req.headers['x-guest-access-token'] as string);
  if (headerToken && typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }
  if (req.body && typeof req.body.guestAccessToken === 'string' && req.body.guestAccessToken.trim()) {
    return req.body.guestAccessToken.trim();
  }
  return null;
}

/**
 * Cryptographic Order Access Verification
 * Enforces:
 * 1. Admin access override if authorized
 * 2. Authenticated user ownership check
 * 3. Guest cryptographic access token verification (prevents enumeration / unauthorized retrieval)
 */
function verifyOrderAccess(
  order: {
    user_id: string | null;
    guest_access_token_hash?: string | null;
    guest_access_token?: string | null;
    shipping_address_snapshot?: any;
    customer_email?: string | null;
  },
  req: AuthenticatedRequest,
  isAdmin: boolean = false
): { authorized: boolean; statusCode: number; error?: string } {
  // 1. Admin always has authorized access
  if (isAdmin) {
    return { authorized: true, statusCode: 200 };
  }

  // 2. Order owned by an authenticated customer
  if (order.user_id) {
    if (!req.user) {
      return {
        authorized: false,
        statusCode: 401,
        error: 'Authentication required to access this order.',
      };
    }
    if (req.user.id !== order.user_id) {
      return {
        authorized: false,
        statusCode: 403,
        error: 'Unauthorized: You do not have access to this order.',
      };
    }
    return { authorized: true, statusCode: 200 };
  }

  // 3. Guest order (order.user_id is null)
  const providedGuestToken = extractGuestToken(req);
  if (!providedGuestToken) {
    return {
      authorized: false,
      statusCode: 401,
      error: 'Guest order access credential required.',
    };
  }

  const providedHash = hashGuestToken(providedGuestToken);

  let tokenMatches = false;
  const snapshotHash = order.shipping_address_snapshot?.guest_access_token_hash;

  if (order.guest_access_token_hash) {
    tokenMatches = timingSafeCompare(providedHash, order.guest_access_token_hash);
  }
  if (!tokenMatches && snapshotHash) {
    tokenMatches =
      timingSafeCompare(providedHash, snapshotHash) ||
      timingSafeCompare(providedGuestToken, snapshotHash);
  }
  if (!tokenMatches) {
    return {
      authorized: false,
      statusCode: 403,
      error: 'Invalid guest order access credential.',
    };
  }

  return { authorized: true, statusCode: 200 };
}

// =====================================================================
// INVENTORY CONCURRENCY & RESERVATION STATE ENGINE (MUTEX PROTECTED)
// =====================================================================
interface InMemoryVariant {
  variant_id: string;
  stock_quantity: number;
  reserved_quantity: number;
}

const inMemoryStockMap = new Map<string, InMemoryVariant>();
const inMemoryOrdersMap = new Map<string, any>();
const inMemoryReviewsMap = new Map<string, any>();

let inMemoryStockMutex = Promise.resolve();
function withStockMutex<T>(fn: () => Promise<T> | T): Promise<T> {
  const next = inMemoryStockMutex.then(() => fn());
  inMemoryStockMutex = next.then(() => {}, () => {});
  return next;
}

async function returnInMemoryStock(variantId: string, quantity: number): Promise<{ success: boolean }> {
  return withStockMutex(() => {
    let v = inMemoryStockMap.get(variantId);
    if (!v) {
      v = { variant_id: variantId, stock_quantity: 10, reserved_quantity: 0 };
      inMemoryStockMap.set(variantId, v);
    }
    v.stock_quantity += quantity;
    return { success: true };
  });
}

/**
 * Authentication Middleware using Supabase Bearer Token (Mandatory)
 */
async function authenticateUser(req: AuthenticatedRequest, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (allowDevelopmentAuth && !supabaseAdmin) {
      req.user = {
        id: 'guest-or-dev-user',
        email: 'customer@vkvastram.com',
        email_confirmed_at: new Date().toISOString(),
      };
      return next();
    }
    res.status(!supabaseAdmin && isProduction ? 503 : 401).json({
      success: false,
      error: !supabaseAdmin && isProduction
        ? 'Authentication service is unavailable.'
        : 'Authorization header missing or invalid.',
    });
    return;
  }

  const token = authHeader.replace('Bearer ', '').trim();

  // Never accept simulated identities unless explicitly enabled for local development.
  if (allowDevelopmentAuth && (token.startsWith('user_') || token.startsWith('mock_') || token.startsWith('dev_'))) {
    const parts = token.split('_');
    const isUnverified = token.toLowerCase().includes('unverified');
    req.user = {
      id: token,
      email: parts.length > 2 ? parts.slice(2).join('_') : `${token}@example.com`,
      email_confirmed_at: isUnverified ? null : new Date().toISOString(),
    };
    return next();
  }

  if (!supabaseAdmin) {
    if (allowDevelopmentAuth) {
      req.user = {
        id: 'dev-user',
        email: 'customer@vkvastram.com',
        email_confirmed_at: new Date().toISOString(),
      };
      return next();
    }
    res.status(503).json({ success: false, error: 'Authentication service is unavailable.' });
    return;
  }

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ success: false, error: 'Invalid or expired authentication token.' });
      return;
    }
    req.user = {
      id: user.id,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      confirmed_at: (user as any).confirmed_at,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata,
    };
    next();
  } catch (err: any) {
    res.status(401).json({ success: false, error: 'Authentication verification failed.' });
  }
}

/**
 * Optional Authentication Middleware:
 * If an Authorization header is provided, verifies with Supabase.
 * If no Authorization header is provided, allows guest requests with req.user = undefined.
 */
async function optionalAuthenticateUser(req: AuthenticatedRequest, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = undefined;
    return next();
  }

  const token = authHeader.replace('Bearer ', '').trim();

  // Never accept simulated identities unless explicitly enabled for local development.
  if (allowDevelopmentAuth && (token.startsWith('user_') || token.startsWith('mock_') || token.startsWith('dev_'))) {
    const parts = token.split('_');
    const isUnverified = token.toLowerCase().includes('unverified');
    req.user = {
      id: token,
      email: parts.length > 2 ? parts.slice(2).join('_') : `${token}@example.com`,
      email_confirmed_at: isUnverified ? null : new Date().toISOString(),
    };
    return next();
  }

  if (!supabaseAdmin) {
    if (allowDevelopmentAuth) {
      req.user = {
        id: 'dev-user',
        email: 'customer@vkvastram.com',
        email_confirmed_at: new Date().toISOString(),
      };
      return next();
    }
    res.status(503).json({ success: false, error: 'Authentication service is unavailable.' });
    return;
  }

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ success: false, error: 'Invalid or expired authentication token.' });
      return;
    }
    req.user = {
      id: user.id,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      confirmed_at: (user as any).confirmed_at,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata,
    };
    next();
  } catch (err: any) {
    res.status(401).json({ success: false, error: 'Authentication verification failed.' });
  }
}


// Small process-local fallback limiter. Production should run a single trusted proxy hop
// (Render) or configure TRUST_PROXY_HOPS explicitly. Webhooks are intentionally excluded.
type LimitBucket = { count: number; resetAt: number };
const rateLimitBuckets = new Map<string, LimitBucket>();
function rateLimit(options: { windowMs: number; max: number; key?: (req: Request) => string; message?: string; bucketName?: string }) {
  return (req: Request, res: Response, next: () => void) => {
    const now = Date.now();
    const identity = options.key ? options.key(req) : req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${options.bucketName || 'default'}:${options.windowMs}:${options.max}:${identity}`;
    let bucket = rateLimitBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      rateLimitBuckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader('RateLimit-Limit', String(options.max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, options.max - bucket.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > options.max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      res.status(429).json({ success: false, error: options.message || 'Too many requests. Please try again shortly.' });
      return;
    }
    next();
    // Bound memory use for long-lived processes.
    if (rateLimitBuckets.size > 5000) {
      for (const [k, v] of rateLimitBuckets) if (v.resetAt <= now) rateLimitBuckets.delete(k);
    }
  };
}

function safePostgrestSearch(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[,%()\\*"']/g, ' ')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function hasImageSignature(buffer: Buffer, contentType: string): boolean {
  const type = contentType.toLowerCase();
  if (type === 'image/jpeg' || type === 'image/jpg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (type === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (type === 'image/webp') {
    return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_NUMBER_RE = /^VKV(?:-[A-Z0-9]{1,20}){1,5}$/i;

async function startServer() {
  const app = express();

  // Render forwards one proxy hop. Do not trust arbitrary X-Forwarded-For chains.
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS || (isProduction ? 1 : 0));
  if (Number.isInteger(proxyHops) && proxyHops >= 0 && proxyHops <= 3) app.set('trust proxy', proxyHops);

  // Baseline security headers (intentionally no CSP here: storefront checkout and Vite
  // require a separately tested CSP policy before one can safely be enforced).
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  // Route-specific parsers run first: preserve exact raw webhook bytes for HMAC,
  // and allow bounded image payloads without a permissive global 10 MB parser.
  app.use('/api/payment/webhook', express.json({
    limit: '256kb',
    verify: (req: any, _res, buf) => { req.rawBody = Buffer.from(buf); },
  }));
  app.use('/api/admin/media/upload', express.json({ limit: '16mb' }));
  app.use('/api/reviews/upload-image', express.json({ limit: '7mb' }));
  app.use(express.json({ limit: '1mb' }));

  // Route families: payment/order/coupon endpoints get tighter limits; admin routes
  // are additionally bounded. Razorpay webhook retries are deliberately not limited.
  app.use('/api/orders/create', rateLimit({ windowMs: 60_000, max: 12 , bucketName: 'orders-create' }));
  app.use('/api/orders', rateLimit({ windowMs: 60_000, max: 45 , bucketName: 'orders' }));
  app.use('/api/payment/create-order', rateLimit({ windowMs: 60_000, max: 8 , bucketName: 'payment-create' }));
  app.use('/api/payment/verify', rateLimit({ windowMs: 60_000, max: 12 , bucketName: 'payment-verify' }));
  app.use('/api/payment/failure', rateLimit({ windowMs: 60_000, max: 12 , bucketName: 'payment-failure' }));
  app.use('/api/payment/abandon', rateLimit({ windowMs: 60_000, max: 12 , bucketName: 'payment-abandon' }));
  app.use('/api/coupons/validate', rateLimit({ windowMs: 60_000, max: 20 , bucketName: 'coupon-validate' }));
  app.use('/api/admin', rateLimit({ windowMs: 60_000, max: 120 , bucketName: 'admin' }));
  app.use('/api/auth', rateLimit({ windowMs: 60_000, max: 10 , bucketName: 'auth' }));

  // -------------------------------------------------------------------
  // 1. Health Check Endpoint
  // Strict Security: NEVER expose any secrets, tokens, or private credentials
  // -------------------------------------------------------------------
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'VK VASTRAM Commerce & Razorpay Payment API',
      timestamp: new Date().toISOString(),
      supabaseConfigured: Boolean(supabaseAdmin),
      razorpayConfigured: Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET),
      razorpayWebhookConfigured: Boolean(RAZORPAY_WEBHOOK_SECRET),
      isTestMode: RAZORPAY_KEY_ID.startsWith('rzp_test_') || !RAZORPAY_KEY_ID,
    });
  });

  // -------------------------------------------------------------------
  // 2. Public Payment Configuration
  // Strict Security: Only delivers public Key ID for client checkout SDK
  // -------------------------------------------------------------------
  app.get('/api/payment/config', (_req: Request, res: Response) => {
    res.json({
      keyId: RAZORPAY_KEY_ID,
      isTestMode: RAZORPAY_KEY_ID.startsWith('rzp_test_') || !RAZORPAY_KEY_ID,
      isConfigured: Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET),
    });
  });

  // -------------------------------------------------------------------
  // 3. POST /api/payment/create-order (SERVER-AUTHORITATIVE)
  // -------------------------------------------------------------------
  app.post(
    '/api/payment/create-order',
    optionalAuthenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { orderId } = req.body;
        const userId = req.user?.id;

        if (!db || (isProduction && !SUPABASE_SERVICE_ROLE_KEY)) {
          res.status(503).json({ success: false, error: 'Persistent payment storage is unavailable.' });
          return;
        }
        if (isProduction && (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET || RAZORPAY_KEY_SECRET.includes('placeholder'))) {
          res.status(503).json({ success: false, error: 'Razorpay is not configured.' });
          return;
        }

        if (!orderId) {
          res.status(400).json({ success: false, error: 'Order ID is required.' });
          return;
        }

        let authoritativeTotal = 0;
        let orderNumber = `VKV-${Date.now()}`;
        let currency = 'INR';
        let customerName = 'VK Vastram Patron';
        let customerEmail = req.user?.email || '';
        let customerPhone = '';

        // 1. Authoritative lookup from Supabase Database
        // IGNORE any client-supplied amount, total, or discounts
        let order: any = null;
        if (db) {
          const { data, error } = await db
            .from('orders')
            .select(`
              id,
              order_number,
              user_id,
              total_amount,
              currency,
              payment_status,
              order_status,
              reservation_expires_at,
              shipping_address_snapshot,
              guest_access_token_hash
            `)
            .eq('id', orderId)
            .maybeSingle();
          if (error) throw error;
          if (data) order = data;
        }

        if (!order) {
          res.status(db ? 404 : (isProduction ? 503 : 404)).json({ success: false, error: 'Order not found.' });
          return;
        }

        let isAdmin = false;
        if (req.user && db) {
          const { data: profile } = await db
            .from('profiles')
            .select('role')
            .eq('id', req.user.id)
            .maybeSingle();
          isAdmin = profile?.role === 'admin';
        }

          // Authoritative order access verification (enforces customer isolation & guest credential)
          const auth = verifyOrderAccess(order, req, isAdmin);
          if (!auth.authorized) {
            res.status(auth.statusCode).json({ success: false, error: auth.error });
            return;
          }

          // Status Validation: Check if already paid or cancelled
          if (order.payment_status === 'captured') {
            res.status(409).json({
              success: false,
              error: 'Order has already been paid and finalized.',
            });
            return;
          }

          if (order.order_status === 'cancelled') {
            res.status(409).json({
              success: false,
              error: 'Cannot initiate payment for a cancelled order.',
            });
            return;
          }

          if (order.reservation_expires_at && new Date(order.reservation_expires_at).getTime() <= Date.now()) {
            res.status(410).json({ success: false, error: 'Order inventory reservation has expired.' });
            return;
          }

          // Read authoritative numbers directly from database record
          authoritativeTotal = Number(order.total_amount);
          orderNumber = order.order_number;
          currency = order.currency || 'INR';

          const addressSnapshot = order.shipping_address_snapshot as any;
          if (addressSnapshot) {
            customerName =
              addressSnapshot.recipientName || addressSnapshot.recipient_name || customerName;
            customerPhone = addressSnapshot.phone || '';
            if (addressSnapshot.email) {
              customerEmail = addressSnapshot.email;
            }
          }
          if ((order as any).customer_email) {
            customerEmail = (order as any).customer_email;
          }
          if ((order as any).customer_phone) {
            customerPhone = (order as any).customer_phone;
          }
          if ((order as any).customer_name) {
            customerName = (order as any).customer_name;
          }

        // Convert authoritative total to integer paise
        const amountInPaise = Math.round(authoritativeTotal * 100);

        if (amountInPaise <= 0 || !Number.isInteger(amountInPaise)) {
          res
            .status(400)
            .json({ success: false, error: 'Authoritative order amount must be a positive integer.' });
          return;
        }

        let razorpayOrderId = '';

        // 2. Create Razorpay Order via official API using server-side credentials
        if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET && !RAZORPAY_KEY_ID.includes('placeholder') && !RAZORPAY_KEY_SECRET.includes('placeholder')) {
          const authString = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
          const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${authString}`,
            },
            body: JSON.stringify({
              amount: amountInPaise,
              currency: currency,
              receipt: orderNumber,
              notes: {
                orderId,
                orderNumber,
                userId: userId || 'guest',
              },
            }),
          });

          if (!rzpResponse.ok) {
            const errorData = await rzpResponse.json();
            console.error('Razorpay API error creating order:', errorData);
            res.status(502).json({
              success: false,
              error: 'Failed to initialize payment with Razorpay. Please retry.',
            });
            return;
          }

          const rzpData = await rzpResponse.json();
          razorpayOrderId = rzpData.id;
        } else {
          res.status(503).json({ success: false, error: 'Razorpay is not configured.' });
          return;
        }

        // 3. Persist Razorpay Order ID in database payments table
        if (!supabaseAdmin) {
          res.status(503).json({ success: false, error: 'Persistent payment storage is unavailable.' });
          return;
        }
        // Each Razorpay order is a distinct persisted attempt. Never overwrite an
        // earlier attempt: a late capture/webhook must still reconcile against its ID.
        const { error: paymentInsertError } = await supabaseAdmin.from('payments').insert({
          order_id: orderId,
          provider: 'razorpay',
          provider_order_id: razorpayOrderId,
          amount: authoritativeTotal,
          currency,
          status: 'pending',
          method: 'Razorpay Online',
          metadata: { attempt_created_at: new Date().toISOString() },
        });
        if (paymentInsertError) {
          // The provider order exists but persistence failed. Do not expose it to the
          // browser; log only a request-safe error and let operations reconcile orphan IDs.
          console.error('[payment/create-order] could not persist provider order attempt:', paymentInsertError.code || 'DB_ERROR');
          res.status(503).json({ success: false, error: 'Unable to prepare payment safely. Please retry.' });
          return;
        }

        res.json({
          success: true,
          keyId: RAZORPAY_KEY_ID,
          razorpayOrderId,
          amount: amountInPaise,
          currency,
          orderNumber,
          customerName,
          customerEmail,
          customerPhone,
          notes: {
            orderId,
            orderNumber,
          },
        });
      } catch (err: any) {
        console.error('Unhandled error in /api/payment/create-order:', err);
        res.status(500).json({
          success: false,
          error: 'An internal error occurred while generating payment order.',
        });
      }
    }
  );

  // -------------------------------------------------------------------
  // 4. POST /api/payment/verify (CRYPTOGRAPHIC VERIFICATION FIRST)
  // -------------------------------------------------------------------
  app.post(
    '/api/payment/verify',
    optionalAuthenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
        const userId = req.user?.id;

        // Step 1: Validate presence of required identifiers
        if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
          res.status(400).json({
            success: false,
            verified: false,
            error: 'Missing required payment verification identifiers.',
          });
          return;
        }

        if (!supabaseAdmin || !db || (isProduction && !SUPABASE_SERVICE_ROLE_KEY)) {
          res.status(503).json({ success: false, verified: false, error: 'Persistent payment storage is unavailable.' });
          return;
        }

        const { data: authorizedOrder, error: authorizedOrderError } = await supabaseAdmin
          .from('orders').select('id, order_number, user_id, total_amount, currency, payment_status, order_status, shipping_address_snapshot, guest_access_token_hash')
          .eq('id', orderId).maybeSingle();
        if (authorizedOrderError) throw authorizedOrderError;
        if (!authorizedOrder) {
          res.status(404).json({ success: false, verified: false, error: 'Order not found.' });
          return;
        }
        let authorizedAdmin = false;
        if (req.user) {
          const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('role').eq('id', req.user.id).maybeSingle();
          if (profileError) throw profileError;
          authorizedAdmin = profile?.role === 'admin';
        }
        const orderAccess = verifyOrderAccess(authorizedOrder, req, authorizedAdmin);
        if (!orderAccess.authorized) {
          res.status(orderAccess.statusCode).json({ success: false, verified: false, error: orderAccess.error });
          return;
        }
        const { data: associatedPayment, error: paymentLookupError } = await supabaseAdmin
          .from('payments').select('id, provider_order_id, status, amount, currency, provider_payment_id').eq('order_id', orderId).eq('provider_order_id', razorpayOrderId).maybeSingle();
        if (paymentLookupError) throw paymentLookupError;
        if (!associatedPayment || associatedPayment.provider_order_id !== razorpayOrderId || !associatedPayment.id) {
          res.status(400).json({ success: false, verified: false, error: 'No matching persisted payment attempt.' });
          return;
        }

        // Step 2: CRYPTOGRAPHIC SIGNATURE VERIFICATION FIRST (BEFORE ANY IDEMPOTENCY / ALREADY-PAID SHORTCUT)
        let isSignatureValid = false;

        if (RAZORPAY_KEY_SECRET && !RAZORPAY_KEY_SECRET.includes('placeholder')) {
          const generatedSignature = crypto
            .createHmac('sha256', RAZORPAY_KEY_SECRET)
            .update(`${razorpayOrderId}|${razorpayPaymentId}`)
            .digest('hex');

          try {
            isSignatureValid = timingSafeCompare(generatedSignature, razorpaySignature);
          } catch {
            isSignatureValid = false;
          }
        }

        // If signature is invalid: REJECT IMMEDIATELY. Never proceed to state transitions!
        if (!isSignatureValid) {
          console.warn(`[SECURITY] Cryptographic signature verification failed for order ${orderId}`);

          res.status(400).json({
            success: false,
            verified: false,
            error: 'Payment signature could not be verified. Your order has not been marked as paid.',
          });
          return;
        }

        if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET || RAZORPAY_KEY_SECRET.includes('placeholder')) {
          res.status(503).json({ success: false, verified: false, error: 'Razorpay verification is not configured.' });
          return;
        }
        const providerResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpayPaymentId)}`, {
          headers: { Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}` },
        });
        if (!providerResponse.ok) {
          res.status(502).json({ success: false, verified: false, error: 'Unable to confirm payment with Razorpay.' });
          return;
        }
        const providerPayment: any = await providerResponse.json();
        const expectedAmount = Math.round(Number(authorizedOrder.total_amount) * 100);
        if (providerPayment.id !== razorpayPaymentId || providerPayment.order_id !== razorpayOrderId || providerPayment.status !== 'captured' || Number(providerPayment.amount) !== expectedAmount || providerPayment.currency !== (authorizedOrder.currency || 'INR') || Number(associatedPayment.amount) !== Number(authorizedOrder.total_amount) || associatedPayment.currency !== (authorizedOrder.currency || 'INR')) {
          res.status(400).json({ success: false, verified: false, error: 'Razorpay payment does not match this order.' });
          return;
        }

        // Step 3: Identify order and verify customer ownership
        let orderRecord: any = null;
        if (supabaseAdmin) {
          const { data: order, error: orderErr } = await supabaseAdmin
            .from('orders')
            .select('id, order_number, user_id, total_amount, payment_status, order_status, shipping_address_snapshot')
            .eq('id', orderId)
            .single();

          if (orderErr || !order) {
            res.status(404).json({ success: false, verified: false, error: 'Order not found.' });
            return;
          }

          let isAdmin = false;
          if (req.user) {
            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('role')
              .eq('id', req.user.id)
              .maybeSingle();
            isAdmin = profile?.role === 'admin';
          }

          const auth = verifyOrderAccess(order, req, isAdmin);
          if (!auth.authorized) {
            res.status(auth.statusCode).json({ success: false, verified: false, error: auth.error });
            return;
          }

          orderRecord = order;

          // Step 4: Strict Association Check:
          // Verify that this Razorpay Order ID matches the persisted payment record for this specific order!
          const { data: paymentRecord, error: paymentRecordError } = await supabaseAdmin
            .from('payments')
            .select('id, provider_order_id, status')
            .eq('order_id', orderId)
            .eq('provider_order_id', razorpayOrderId)
            .maybeSingle();

          if (paymentRecordError) throw paymentRecordError;

          if (
            paymentRecord &&
            paymentRecord.provider_order_id &&
            paymentRecord.provider_order_id !== razorpayOrderId
          ) {
            console.warn(
              `[SECURITY] Razorpay order mismatch for order ${orderId}: expected ${paymentRecord.provider_order_id}, received ${razorpayOrderId}`
            );
            res.status(400).json({
              success: false,
              verified: false,
              error: 'Payment identifiers do not match the registered order attempt.',
            });
            return;
          }

          // Reconcile payment + order + inventory in one database transaction. The RPC locks
          // the order row, matching the cancellation RPC's lock order to prevent races.
          const alreadyCapturedBeforeVerify = await isOrderPaymentCaptured(orderId);
          const { data: reconciliationResult, error: reconciliationError } = await supabaseAdmin.rpc(
            'reconcile_captured_payment_for_order',
            {
              p_order_id: orderId,
              p_provider_order_id: razorpayOrderId,
              p_provider_payment_id: razorpayPaymentId,
              p_provider_signature: razorpaySignature,
            }
          );
          if (reconciliationError) throw reconciliationError;
          if (!reconciliationResult || reconciliationResult.success !== true) {
            throw new Error(reconciliationResult?.error || 'Atomic payment reconciliation failed');
          }

          if (reconciliationResult.refund_required === true) {
            await supabaseAdmin.from('orders').update({ refund_status: 'pending', updated_at: new Date().toISOString() }).eq('id', orderId).neq('refund_status', 'completed');
            void dispatchAdminOrderAlert(orderId, 'refund_required', 'pending');
            console.error(`[PAYMENT RECONCILIATION REQUIRED] Razorpay captured payment for order ${orderId}; refund/manual review required.`);
            res.status(409).json({
              success: false,
              verified: false,
              captured: true,
              refundRequired: true,
              error: 'Payment was captured after the order was cancelled. The order remains cancelled and requires refund review.',
            });
            return;
          }

          // Payment confirmed: only now does the order exist for the admin and the customer.
          if (!alreadyCapturedBeforeVerify) void notifyOrderConfirmed(orderId);
        }

        res.json({
          success: true,
          verified: true,
          orderId,
          orderNumber: orderRecord?.order_number || `VKV-${Date.now()}`,
        });
      } catch (err: any) {
        console.error('Unhandled error in /api/payment/verify:', err);
        res.status(500).json({
          success: false,
          verified: false,
          error: 'An internal error occurred during payment verification.',
        });
      }
    }
  );

  // -------------------------------------------------------------------
  // 4b. POST /api/payment/failure (RECORD FAILED ATTEMPT ON SAME ORDER)
  // -------------------------------------------------------------------
  app.post('/api/payment/failure', optionalAuthenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { orderId, razorpayOrderId, code, description } = req.body || {};
      if (!orderId || !razorpayOrderId) {
        res.status(400).json({ success: false, error: 'Order and payment attempt identifiers are required.' });
        return;
      }
      if (!supabaseAdmin || !db || (isProduction && !SUPABASE_SERVICE_ROLE_KEY)) {
        res.status(503).json({ success: false, error: 'Persistent payment storage is unavailable.' });
        return;
      }
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('id,order_number,user_id,payment_status,guest_access_token_hash')
        .eq('id', orderId).maybeSingle();
      if (orderError) throw orderError;
      if (!order) { res.status(404).json({ success: false, error: 'Order not found.' }); return; }
      let isAdmin = false;
      if (req.user) {
        const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', req.user.id).maybeSingle();
        isAdmin = profile?.role === 'admin';
      }
      const access = verifyOrderAccess(order, req, isAdmin);
      if (!access.authorized) { res.status(access.statusCode).json({ success: false, error: access.error }); return; }
      const { data: payment, error: paymentError } = await supabaseAdmin
        .from('payments').select('id,status,provider_order_id').eq('order_id', orderId)
        .eq('provider_order_id', razorpayOrderId).maybeSingle();
      if (paymentError) throw paymentError;
      if (!payment) { res.status(400).json({ success: false, error: 'Payment attempt does not belong to this order.' }); return; }
      // Never downgrade a successful/captured payment because of a stale failure callback.
      if (['captured', 'paid', 'succeeded'].includes(String(payment.status || '').toLowerCase()) ||
          ['paid', 'captured'].includes(String(order.payment_status || '').toLowerCase())) {
        res.json({ success: true, unchanged: true, orderId, orderNumber: order.order_number });
        return;
      }
      const now = new Date().toISOString();
      const safeReason = String(description || code || 'Payment was declined or failed at the payment gateway').slice(0, 500);
      // Update the specific attempt. Some older deployments may not yet have the
      // optional error_reason migration; if so, retry the update without that column.
      let paymentUpdate = await supabaseAdmin.from('payments').update({
        status: 'failed', error_reason: safeReason, updated_at: now,
      }).eq('id', payment.id).select('id').maybeSingle();
      if (paymentUpdate.error && /error_reason|column .* does not exist|schema cache/i.test(paymentUpdate.error.message || '')) {
        console.warn('[payment/failure] error_reason column unavailable; recording status without optional detail.');
        paymentUpdate = await supabaseAdmin.from('payments').update({
          status: 'failed', updated_at: now,
        }).eq('id', payment.id).select('id').maybeSingle();
      }
      if (paymentUpdate.error) throw paymentUpdate.error;
      if (!paymentUpdate.data) {
        // Idempotent retry: a prior request may already have updated the attempt.
        const { data: latestPayment, error: latestPaymentError } = await supabaseAdmin
          .from('payments').select('id,status').eq('id', payment.id).maybeSingle();
        if (latestPaymentError) throw latestPaymentError;
        if (!latestPayment || !['failed', 'captured', 'paid', 'succeeded'].includes(String(latestPayment.status || '').toLowerCase())) {
          throw new Error('Payment attempt status could not be confirmed after update.');
        }
      }
      // Do not use a PostgREST `in` filter here: compare the authoritative status
      // already read above, then update only non-successful orders. Captured orders
      // are protected against late failure callbacks.
      if (!['paid', 'captured'].includes(String(order.payment_status || '').toLowerCase())) {
        const { error: updateOrderError } = await supabaseAdmin.from('orders').update({
          payment_status: 'failed', updated_at: now,
        }).eq('id', orderId).not('payment_status', 'eq', 'captured').not('payment_status', 'eq', 'paid');
        if (updateOrderError) throw updateOrderError;
      }
      res.json({ success: true, orderId, orderNumber: order.order_number, paymentStatus: 'failed' });
    } catch (err: any) {
      console.error('Unable to persist payment failure:', err);
      res.status(500).json({ success: false, error: 'Could not update payment status. Please retry or contact support with your existing order number.' });
    }
  });

  // -------------------------------------------------------------------
  // 4c. POST /api/payment/abandon (CUSTOMER CLOSED THE PAYMENT WINDOW WITHOUT PAYING)
  // Releases the stock hold immediately and cancels the unpaid online order, so a skipped
  // payment never keeps a product "sold out". A payment that was actually taken is never
  // touched: the database and Razorpay are both checked first.
  // -------------------------------------------------------------------
  app.post('/api/payment/abandon', optionalAuthenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { orderId } = req.body || {};
      if (!orderId || typeof orderId !== 'string') {
        res.status(400).json({ success: false, error: 'Order identifier is required.' });
        return;
      }
      if (!supabaseAdmin || !db || (isProduction && !SUPABASE_SERVICE_ROLE_KEY)) {
        res.status(503).json({ success: false, error: 'Persistent order storage is unavailable.' });
        return;
      }
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('id,order_number,user_id,payment_status,order_status,guest_access_token_hash')
        .eq('id', orderId).maybeSingle();
      if (orderError) throw orderError;
      if (!order) { res.status(404).json({ success: false, error: 'Order not found.' }); return; }

      let isAdmin = false;
      if (req.user) {
        const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', req.user.id).maybeSingle();
        isAdmin = profile?.role === 'admin';
      }
      const access = verifyOrderAccess(order, req, isAdmin);
      if (!access.authorized) { res.status(access.statusCode).json({ success: false, error: access.error }); return; }

      const alreadyPaid = ['captured', 'paid', 'authorized'].includes(String(order.payment_status || '').toLowerCase());
      if (order.order_status !== 'pending' || alreadyPaid) {
        res.json({ success: true, abandoned: false, unchanged: true, paid: alreadyPaid, orderStatus: order.order_status, paymentStatus: order.payment_status });
        return;
      }

      // Never release stock if Razorpay says money was taken (the customer may have paid and closed
      // the window a moment later). If Razorpay cannot be reached, do nothing: the sweeper will
      // release the hold when the checkout window ends.
      const { data: attempts, error: attemptsError } = await supabaseAdmin
        .from('payments').select('provider,provider_order_id,status').eq('order_id', orderId);
      if (attemptsError) throw attemptsError;
      if ((attempts || []).some((a: any) => ['captured', 'authorized', 'paid', 'succeeded'].includes(String(a.status || '').toLowerCase()))) {
        res.json({ success: true, abandoned: false, unchanged: true, paid: true });
        return;
      }
      if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
        for (const attempt of attempts || []) {
          if (!attempt.provider_order_id) continue;
          const providerResponse = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(attempt.provider_order_id)}/payments`, {
            headers: { Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}` },
          });
          if (!providerResponse.ok) {
            res.json({ success: true, abandoned: false, deferred: true });
            return;
          }
          const providerData: any = await providerResponse.json();
          if (Array.isArray(providerData.items) && providerData.items.some((item: any) => ['captured', 'authorized'].includes(item.status))) {
            res.json({ success: true, abandoned: false, unchanged: true, paid: true });
            return;
          }
        }
      }

      const { data: result, error: abandonError } = await (supabaseAdmin as any).rpc('abandon_unpaid_order', {
        p_order_id: orderId,
        p_reason: 'Payment not completed: customer closed the payment window',
      });
      if (abandonError) throw abandonError;
      if (!result || result.success !== true) throw new Error(result?.error || 'Could not release the unpaid order.');

      res.json({
        success: true,
        abandoned: Boolean(result.abandoned),
        orderId,
        orderNumber: order.order_number,
        reason: result.reason || undefined,
      });
    } catch (err: any) {
      console.error('Unable to abandon unpaid order:', err);
      res.status(500).json({ success: false, error: 'Could not release the unpaid order. It will be released automatically shortly.' });
    }
  });

  // -------------------------------------------------------------------
  // 5. POST /api/orders/create (SERVER-AUTHORITATIVE ORDER CREATION)
  // Supports Guest & Authenticated Patrons
  // -------------------------------------------------------------------
  app.post(
    '/api/orders/create',
    optionalAuthenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const {
          items,
          shippingAddress,
          billingAddress,
          paymentMethod,
          customerName,
          customerEmail,
          customerPhone,
          notes,
        } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
          res.status(400).json({ success: false, error: 'Cart items are required.' });
          return;
        }

        if (
          !shippingAddress ||
          !shippingAddress.recipientName ||
          !shippingAddress.addressLine1 ||
          !shippingAddress.city ||
          !shippingAddress.state ||
          !(shippingAddress.pincode || shippingAddress.postalCode)
        ) {
          res.status(400).json({ success: false, error: 'Complete delivery address is required.' });
          return;
        }

        const normalizedPincode = shippingAddress.pincode || shippingAddress.postalCode;
        shippingAddress.pincode = normalizedPincode;

        if (!db || (isProduction && !SUPABASE_SERVICE_ROLE_KEY)) {
          res.status(503).json({ success: false, error: 'Persistent order and inventory storage is unavailable.' });
          return;
        }
        if (paymentMethod !== 'online' && paymentMethod !== 'cod') {
          res.status(400).json({ success: false, error: 'Unsupported payment method.' });
          return;
        }

        const orderLines = validateOrderLines(items);
        const boundedText = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
        const nameValue = customerName || shippingAddress.recipientName;
        const emailValue = customerEmail || shippingAddress.email || req.user?.email || '';
        const phoneValue = customerPhone || shippingAddress.phone || '';
        if (!boundedText(nameValue, 100) ||
            !boundedText(shippingAddress.addressLine1, 180) ||
            (shippingAddress.addressLine2 != null && String(shippingAddress.addressLine2).length > 180) ||
            !boundedText(shippingAddress.city, 80) ||
            !boundedText(shippingAddress.state, 80) ||
            !/^\d{6}$/.test(String(shippingAddress.pincode || shippingAddress.postalCode || '')) ||
            !/^[+\d()\-\s]{10,18}$/.test(String(phoneValue)) ||
            (emailValue && (String(emailValue).length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(emailValue)))) ||
            (notes != null && String(notes).length > 500)) {
          res.status(400).json({ success: false, error: 'Please check your name, contact details, and delivery address.' });
          return;
        }
        const normalizedEmail = String(emailValue || '').trim().toLowerCase();
        const normalizedPhone = String(phoneValue || '').replace(/[^+\d]/g, '').slice(0, 18);
        // Gentle COD abuse controls: cap large COD baskets and throttle repeated attempts
        // by contact details without blocking routine returning-customer orders.
        if (paymentMethod === 'cod') {
          const ipLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20 });
          const phoneLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 8, key: () => `cod-phone:${normalizedPhone}` });
          const emailLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 8, key: () => `cod-email:${normalizedEmail}` });
          ipLimiter(req, res, () => {});
          if (res.headersSent) return;
          phoneLimiter(req, res, () => {});
          if (res.headersSent) return;
          if (normalizedEmail) {
            emailLimiter(req, res, () => {});
            if (res.headersSent) return;
          }
          const { data: pricedVariants, error: priceError } = await db
            .from('product_variants')
            .select('id,price_override,products!inner(price,status)')
            .in('id', orderLines.map(line => line.variant_id));
          if (priceError) throw priceError;
          const priceMap = new Map((pricedVariants || []).map((v: any) => [v.id, v]));
          const { data: generalSettings } = await db.from('site_settings').select('value').eq('key', 'general').maybeSingle();
          const fallPicoPrice = Math.max(0, Number(generalSettings?.value?.fall_pico_price || 0));
          const authoritativeSubtotal = orderLines.reduce((sum, line) => {
            const variant: any = priceMap.get(line.variant_id);
            if (!variant || variant.products?.status !== 'active') return sum + 1_000_000_000;
            const surcharge = line.metadata.includeFallPico === true ? fallPicoPrice : 0;
            return sum + (Number(variant.price_override ?? variant.products.price) + surcharge) * line.quantity;
          }, 0);
          // Conservative COD subtotal ceiling leaves room for applicable tax/shipping.
          if (!Number.isFinite(authoritativeSubtotal) || authoritativeSubtotal > 20_000) {
            res.status(400).json({ success: false, error: 'Cash on Delivery is unavailable for orders above ₹20,000 before tax and delivery. Please choose online payment.' });
            return;
          }
        }
        const userId = req.user?.id || null;
        const isGuest = !userId;
        const email = customerEmail || shippingAddress.email || req.user?.email || null;
        const phone = customerPhone || shippingAddress.phone || null;
        const name = customerName || shippingAddress.recipientName || null;
        const orderNumber = 'VKV-' + new Date().toISOString().slice(0, 7).replace('-', '') + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
        const guestAccessToken = isGuest ? crypto.randomBytes(24).toString('hex') : null;
        const guestTokenHash = guestAccessToken ? hashGuestToken(guestAccessToken) : null;
        const completeShippingSnapshot = {
          ...shippingAddress,
          recipientName: name || shippingAddress.recipientName,
          email: email || '',
          phone: phone || '',
          isGuest,
          guest_access_token_hash: guestTokenHash,
        };
        const completeBillingSnapshot = billingAddress
          ? { ...billingAddress, isGuest, guest_access_token_hash: guestTokenHash }
          : completeShippingSnapshot;
        
const orderPayload = {
  order_number: orderNumber,
  user_id: userId,
  customer_name: name,
  customer_email: email,
  customer_phone: phone,
  is_guest: isGuest,
  guest_access_token_hash: guestTokenHash,
  shipping_address_snapshot: completeShippingSnapshot,
  billing_address_snapshot: completeBillingSnapshot,
  coupon_code: typeof req.body.couponCode === 'string'
    ? req.body.couponCode.trim().toUpperCase() || null
    : null,
  customer_email_for_coupon: email,
  notes: notes || null,
};


        // Free any expired holds first so stock held by abandoned checkouts is available again.
        await sweepUnpaidOrders();

        const created = await invokeCheckedRpc(db, 'create_order_with_inventory_reservation', {
          p_order: orderPayload,
          p_items: orderLines,
          p_payment_method: paymentMethod,
          p_reservation_minutes: CHECKOUT_HOLD_MINUTES,
        }, 'Order creation');
        if (typeof created.order_id !== 'string' || !created.order_id || typeof created.order_number !== 'string' || !created.order_number) {
          throw new OrderSafetyError('Order service returned an incomplete result.', 503, 'INVALID_RPC_RESULT');
        }
        // COD is confirmed immediately, so notify now. An online order is only "waiting for payment":
        // the admin alert and customer email are sent when the payment is captured instead.
        if (paymentMethod === 'cod') {
          void notifyOrderConfirmed(created.order_id);
        }

        res.json({
          success: true,
          orderId: created.order_id,
          orderNumber: created.order_number,
          guestAccessToken,
          isGuest,
        });
      } catch (err: any) {
        console.error('Unhandled error in /api/orders/create:', err?.code || err?.name, err?.message, err?.details || '', err?.hint || '');
        res.status(err instanceof OrderSafetyError ? err.statusCode : 500).json({
          success: false,
          error: err instanceof OrderSafetyError ? err.message : 'Internal server error creating order.',
          code: err instanceof OrderSafetyError ? err.code : undefined,
        });
      }
    }
  );

  // -------------------------------------------------------------------
  // Public, low-friction tracking lookup: order number + checkout email; returns only tracking essentials.
  app.post('/api/orders/track', async (req: Request, res: Response) => {
    try {
      const orderId = String(req.body?.orderId || '').trim();
      const email = String(req.body?.email || '').trim().toLowerCase();
      if (!orderId || orderId.length > 80 || !/^[A-Za-z0-9_-]+$/.test(orderId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        res.status(400).json({success:false,error:'Enter a valid order ID and checkout email.'}); return;
      }
      if (!supabaseAdmin) { res.status(503).json({success:false,error:'Order tracking is temporarily unavailable.'}); return; }
      const safeOrderNumber = orderId.replace(/[\\%_]/g,'');
      const { data: order, error } = await supabaseAdmin.from('orders')
        .select('id,order_number,customer_email,total_amount,payment_status,order_status,created_at,shipped_at,delivered_at,courier_name,tracking_number,tracking_url,items:order_items(product_name_snapshot,quantity)')
        .eq('order_number',safeOrderNumber).maybeSingle();
      if (error || !order || String(order.customer_email||'').trim().toLowerCase() !== email) {
        res.status(404).json({success:false,error:'We could not find an order matching those details.'}); return;
      }
      res.json({success:true,order:{orderNumber:order.order_number,orderStatus:order.order_status,paymentStatus:order.payment_status,createdAt:order.created_at,shippedAt:order.shipped_at,deliveredAt:order.delivered_at,courierName:order.courier_name,trackingNumber:order.tracking_number,trackingUrl:order.tracking_url,totalAmount:Number(order.total_amount||0),items:order.items||[]}});
    } catch { res.status(500).json({success:false,error:'Unable to look up this order right now.'}); }
  });

  // 6. GET /api/orders/:id (ORDER LOOKUP FOR CONFIRMATION & TRACKING)
  // Supports Guest & Authenticated Patrons
  // -------------------------------------------------------------------
  app.get(
    '/api/orders/:id',
    optionalAuthenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = String(req.params.id || '').trim();
        const isUuid = UUID_RE.test(id || '');
        const isOrderNumber = ORDER_NUMBER_RE.test(id || '');
        if (!id || (!isUuid && !isOrderNumber)) {
          res.status(400).json({ success: false, error: 'A valid order ID or order number is required.' });
          return;
        }

        if (!supabaseAdmin) {
          res.status(404).json({ success: false, error: 'Database not connected.' });
          return;
        }

        const { data: order, error } = await supabaseAdmin
          .from('orders')
          .select(`
            *,
            items:order_items(*),
            payments:payments(id,order_id,provider,provider_order_id,provider_payment_id,amount,currency,status,method,verified_at,created_at)
          `)
          .or(`id.eq.${id},order_number.eq.${id}`)
          .maybeSingle();

        if (error || !order) {
          res.status(404).json({ success: false, error: 'Order not found.' });
          return;
        }

        // Customer Isolation & Guest Cryptographic Token Verification
        let isAdmin = false;
        if (req.user) {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', req.user.id)
            .maybeSingle();
          isAdmin = profile?.role === 'admin';
        }

        const auth = verifyOrderAccess(order, req, isAdmin);
        if (!auth.authorized) {
          res.status(auth.statusCode).json({ success: false, error: auth.error });
          return;
        }

        const paymentRecord = Array.isArray(order.payments)
          ? [...order.payments].sort((a: any, b: any) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).find((p: any) => p.provider_order_id) || order.payments[0]
          : order.payments;

        // Privacy & Data Sanitization: Strip guest tokens and hashes from snapshots
        const sanitizedShippingSnapshot = order.shipping_address_snapshot
          ? { ...(order.shipping_address_snapshot as any) }
          : null;
        if (sanitizedShippingSnapshot) {
          delete sanitizedShippingSnapshot.guestAccessToken;
          delete sanitizedShippingSnapshot.guest_access_token;
          delete sanitizedShippingSnapshot.guest_access_token_hash;
        }

        const sanitizedBillingSnapshot = order.billing_address_snapshot
          ? { ...(order.billing_address_snapshot as any) }
          : null;
        if (sanitizedBillingSnapshot) {
          delete sanitizedBillingSnapshot.guestAccessToken;
          delete sanitizedBillingSnapshot.guest_access_token;
          delete sanitizedBillingSnapshot.guest_access_token_hash;
        }

        res.json({
          success: true,
          order: {
            id: order.id,
            orderNumber: order.order_number,
            userId: order.user_id,
            customerName:
              sanitizedShippingSnapshot?.recipientName || order.customer_name || 'Patron',
            customerEmail:
              sanitizedShippingSnapshot?.email || order.customer_email || '',
            customerPhone:
              sanitizedShippingSnapshot?.phone || order.customer_phone || '',
            isGuest: !order.user_id || Boolean(order.is_guest),
            // Access credentials are NEVER exposed in the order lookup response
            shippingAddressSnapshot: sanitizedShippingSnapshot,
            billingAddressSnapshot: sanitizedBillingSnapshot,
            subtotal: Number(order.subtotal),
            discountAmount: Number(order.discount_amount || 0),
            shippingAmount: Number(order.shipping_amount || 0),
            taxAmount: Number(order.tax_amount || 0),
            totalAmount: Number(order.total_amount),
            currency: order.currency || 'INR',
            paymentStatus: order.payment_status,
            orderStatus: order.order_status,
            refundStatus: order.refund_status || 'not_applicable',
            cancelledAt: order.cancelled_at || null,
            cancellationReason: order.cancellation_reason || '',
            courierName: order.courier_name || '',
            trackingNumber: order.tracking_number || '',
            trackingUrl: order.tracking_url || '',
            shippedAt: order.shipped_at || null,
            deliveredAt: order.delivered_at || null,
            paymentMethod: paymentRecord?.provider === 'cod' ? 'cod' : 'online',
            payment: paymentRecord
              ? {
                  id: paymentRecord.id,
                  orderId: paymentRecord.order_id,
                  provider: paymentRecord.provider,
                  providerOrderId: paymentRecord.provider_order_id,
                  providerPaymentId: paymentRecord.provider_payment_id,
                  amount: Number(paymentRecord.amount),
                  currency: paymentRecord.currency,
                  status: paymentRecord.status,
                  method: paymentRecord.method,
                  verifiedAt: paymentRecord.verified_at,
                  createdAt: paymentRecord.created_at,
                }
              : undefined,
            notes: order.notes,
            createdAt: order.created_at,
            items: (order.items || []).map((i: any) => ({
              id: i.id,
              orderId: i.order_id,
              productVariantId: i.product_variant_id,
              productName: i.product_name_snapshot,
              sku: i.sku_snapshot,
              price: Number(i.price_snapshot),
              quantity: i.quantity,
              totalAmount: Number(i.total_amount),
              productMetadata: i.product_metadata_snapshot || {},
              primaryImage:
                i.product_metadata_snapshot?.primaryImage ||
                '/src/assets/images/hero_vastram_saree_1791192126882.jpg',
            })),
          },
        });
      } catch (err: any) {
        console.error('Error fetching order by ID:', err);
        res.status(500).json({ success: false, error: 'Unable to retrieve this order right now.' });
      }
    }
  );

  // -------------------------------------------------------------------
  // 7. POST /api/customer/link-guest-orders
  // Links past guest orders to newly registered customer account ONLY after verified email
  // -------------------------------------------------------------------
  app.post(
    '/api/customer/link-guest-orders',
    authenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const user = req.user;
        const userId = user?.id;
        const email = user?.email;

        if (!user || !userId || !email) {
          res.status(401).json({ success: false, error: 'Authenticated customer account required.' });
          return;
        }

        // Strict Email Verification Enforcement:
        // Do NOT allow unverified accounts to claim historical guest orders!
        const isEmailVerified = Boolean(
          user.email_confirmed_at ||
          user.confirmed_at ||
          (user.user_metadata && user.user_metadata.email_verified) ||
          (user.app_metadata && user.app_metadata.email_verified)
        );

        if (!isEmailVerified && supabaseAdmin) {
          res.status(403).json({
            success: false,
            error: 'Email address has not been verified. Historical guest orders can only be linked once email verification is completed.',
          });
          return;
        }

        if (!supabaseAdmin) {
          res.json({ success: true, linkedCount: 0 });
          return;
        }

        // 1. Try PostgreSQL stored procedure if available
        const { data, error } = await supabaseAdmin.rpc('link_guest_orders_to_user', {
          target_user_id: userId,
          target_email: email,
        });

        if (!error && typeof data === 'number') {
          res.json({ success: true, linkedCount: data });
          return;
        }

        // 2. Direct database update fallback using supabaseAdmin
        const { data: allUnassignedOrders } = await supabaseAdmin
          .from('orders')
          .select('id, customer_email, shipping_address_snapshot')
          .is('user_id', null);

        let linkedCount = 0;
        if (allUnassignedOrders && allUnassignedOrders.length > 0) {
          const matchingIds = allUnassignedOrders
            .filter(
              (o: any) =>
                (o.customer_email && o.customer_email.toLowerCase() === email.toLowerCase()) ||
                (o.shipping_address_snapshot?.email &&
                  o.shipping_address_snapshot.email.toLowerCase() === email.toLowerCase())
            )
            .map((o: any) => o.id);

          if (matchingIds.length > 0) {
            await supabaseAdmin
              .from('orders')
              .update({
                user_id: userId,
                is_guest: false,
                guest_access_token: null,
                guest_access_token_hash: null,
                updated_at: new Date().toISOString(),
              })
              .in('id', matchingIds);
            linkedCount = matchingIds.length;
          }
        }

        res.json({ success: true, linkedCount });
      } catch (err: any) {
        console.error('Error in /api/customer/link-guest-orders:', err);
        res.status(500).json({ success: false, error: 'Unable to link guest orders right now.' });
      }
    }
  );

  // -------------------------------------------------------------------
  // 8. POST /api/payment/webhook (IDEMPOTENT EVENT RECONCILIATION)
  // -------------------------------------------------------------------
  app.post('/api/payment/webhook', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const webhookSignature = req.headers['x-razorpay-signature'] as string;
      const rawBody = req.rawBody;

      if (!RAZORPAY_WEBHOOK_SECRET || RAZORPAY_WEBHOOK_SECRET.includes('placeholder') || !supabaseAdmin || !db || (isProduction && !SUPABASE_SERVICE_ROLE_KEY)) {
        res.status(isProduction ? 503 : 400).json({ error: 'Webhook verification or persistent storage is not configured.' });
        return;
      }

      // 1. Verify Webhook Signature using RAZORPAY_WEBHOOK_SECRET (Separate from Key Secret)
      {
        if (!webhookSignature || !rawBody) {
          res.status(400).json({ error: 'Missing webhook signature or raw payload.' });
          return;
        }

        const expectedSignature = crypto
          .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
          .update(rawBody)
          .digest('hex');

        let isValidWebhook = false;
        try {
          isValidWebhook = crypto.timingSafeEqual(
            Buffer.from(expectedSignature, 'utf8'),
            Buffer.from(webhookSignature, 'utf8')
          );
        } catch {
          isValidWebhook = false;
        }

        if (!isValidWebhook) {
          console.warn('[SECURITY] Invalid Razorpay webhook signature rejected.');
          res.status(400).json({ error: 'Invalid webhook signature.' });
          return;
        }
      }

      const event = req.body;
      const eventId = (req.headers['x-razorpay-event-id'] as string) || event?.event_id || event?.id;
      const eventType = event?.event;
      if (typeof eventId !== 'string' || !eventId.trim() || typeof eventType !== 'string' || !event.payload) {
        res.status(400).json({ error: 'Malformed webhook event.' });
        return;
      }

      // 2. Authoritative Database Idempotency Check via UNIQUE(event_id)
      if (processedWebhookEventIds.has(eventId)) {
        res.status(200).json({ status: 'already_processed', eventId });
        return;
      }

      if (supabaseAdmin) {
        // Atomic insert attempt into payment_webhook_events
        const { error: insertErr } = await supabaseAdmin.from('payment_webhook_events').insert({
          provider: 'razorpay',
          event_id: eventId,
          event_type: eventType || 'unknown',
          payload: event,
          status: 'processing',
        });

        // PostgreSQL error 23505 indicates unique constraint violation (duplicate event)
        if (insertErr && (insertErr.code === '23505' || insertErr.message.includes('unique'))) {
          const { data: priorEvent, error: priorError } = await supabaseAdmin.from('payment_webhook_events').select('status').eq('event_id', eventId).maybeSingle();
          if (priorError) throw priorError;
          if (priorEvent?.status === 'processed') {
            processedWebhookEventIds.add(eventId);
            res.status(200).json({ status: 'already_processed', eventId });
            return;
          }
          const { error: retryError } = await supabaseAdmin.from('payment_webhook_events').update({ status: 'processing', payload: event, event_type: eventType }).eq('event_id', eventId);
          if (retryError) throw retryError;
        } else if (insertErr) throw insertErr;
      }

      // 3. Process Razorpay Event Payload
      const paymentEntity = event.payload?.payment?.entity;
      const orderEntity = event.payload?.order?.entity;

      const rzpOrderId = paymentEntity?.order_id || orderEntity?.id;
      let rzpPaymentId = paymentEntity?.id;
      let internalOrderId: string | null = null;

      // order.paid carries an order entity rather than a payment entity. Resolve its
      // captured payment from Razorpay before matching it to the persisted attempt.
      if (eventType === 'order.paid' && rzpOrderId && !rzpPaymentId) {
        if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
          res.status(503).json({ error: 'Payment verification is temporarily unavailable.' });
          return;
        }
        const listResponse = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(rzpOrderId)}/payments`, {
          headers: { Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}` },
        });
        if (!listResponse.ok) {
          res.status(503).json({ error: 'Payment verification is temporarily unavailable.' });
          return;
        }
        const listData: any = await listResponse.json();
        const captured = Array.isArray(listData.items) ? listData.items.find((item: any) => item.status === 'captured' && item.order_id === rzpOrderId) : null;
        if (!captured) {
          res.status(400).json({ error: 'No captured payment was found for this provider order.' });
          return;
        }
        rzpPaymentId = captured.id;
      }

      if (!rzpOrderId || (eventType.startsWith('payment.') && !rzpPaymentId)) {
        res.status(400).json({ error: 'Webhook is missing provider identifiers.' });
        return;
      }

      const { data: matchedPayment, error: matchedPaymentError } = await supabaseAdmin
        .from('payments').select('id, order_id, provider_order_id, provider_payment_id, amount, currency')
        .eq('provider_order_id', rzpOrderId).maybeSingle();
      if (matchedPaymentError) throw matchedPaymentError;
      if (!matchedPayment || !matchedPayment.order_id || (rzpPaymentId && matchedPayment.provider_payment_id && matchedPayment.provider_payment_id !== rzpPaymentId)) {
        res.status(400).json({ error: 'Webhook identifiers do not match a persisted payment.' });
        return;
      }
      internalOrderId = matchedPayment.order_id;
      if (paymentEntity && (Number(paymentEntity.amount) !== Math.round(Number(matchedPayment.amount) * 100) || paymentEntity.currency !== matchedPayment.currency)) {
        res.status(400).json({ error: 'Webhook payment amount or currency mismatch.' });
        return;
      }
      // A signed webhook proves origin, while the provider API confirms the current
      // authoritative payment state. Do this before recording a capture as successful.
      if ((eventType === 'payment.captured' || eventType === 'order.paid') && rzpPaymentId) {
        if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
          res.status(503).json({ error: 'Payment verification is temporarily unavailable.' });
          return;
        }
        const providerCheck = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(rzpPaymentId)}`, {
          headers: { Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}` },
        });
        if (!providerCheck.ok) {
          res.status(503).json({ error: 'Payment verification is temporarily unavailable.' });
          return;
        }
        const verifiedEntity: any = await providerCheck.json();
        if (verifiedEntity.id !== rzpPaymentId || verifiedEntity.order_id !== rzpOrderId ||
            verifiedEntity.status !== 'captured' ||
            Number(verifiedEntity.amount) !== Math.round(Number(matchedPayment.amount) * 100) ||
            verifiedEntity.currency !== matchedPayment.currency) {
          res.status(400).json({ error: 'Provider payment does not match the persisted attempt.' });
          return;
        }
      }

      if (supabaseAdmin) {
        const now = new Date().toISOString();

        if (eventType === 'payment.captured' || eventType === 'order.paid') {
          if (!internalOrderId || !rzpOrderId || !rzpPaymentId) {
            throw new Error('Captured payment webhook is missing the order/payment association');
          }

          // The RPC locks the order row and atomically reconciles payment, order status,
          // and inventory. This is serialized against cancel_order_and_reconcile_inventory.
          const alreadyCapturedBeforeWebhook = await isOrderPaymentCaptured(internalOrderId);
          const { data: reconciliationResult, error: reconciliationError } = await supabaseAdmin.rpc(
            'reconcile_captured_payment_for_order',
            {
              p_order_id: internalOrderId,
              p_provider_order_id: rzpOrderId,
              p_provider_payment_id: rzpPaymentId,
              p_provider_signature: null,
            }
          );
          if (reconciliationError) throw reconciliationError;
          if (!reconciliationResult || reconciliationResult.success !== true) {
            throw new Error(reconciliationResult?.error || 'Atomic webhook payment reconciliation failed');
          }
          if (reconciliationResult.refund_required === true) {
            // Capture is persisted, but the order is flagged for admin refund review.
            await supabaseAdmin.from('orders').update({ refund_status: 'pending', updated_at: now }).eq('id', internalOrderId).neq('refund_status', 'completed');
            void dispatchAdminOrderAlert(internalOrderId, 'refund_required', 'pending');
            console.error(`[PAYMENT RECONCILIATION REQUIRED] Razorpay captured payment for order ${internalOrderId}; refund/manual review required.`);
          } else if (!alreadyCapturedBeforeWebhook) {
            // Payment confirmed via webhook (e.g. the customer closed the tab right after paying).
            void notifyOrderConfirmed(internalOrderId);
          }
        } else if (eventType === 'payment.failed') {
          let paymentQuery = supabaseAdmin.from('payments').update({
            status: 'failed',
            provider_payment_id: rzpPaymentId,
            error_reason: paymentEntity?.error_description || 'Payment failed at bank gateway',
            updated_at: now,
          });

          if (rzpOrderId) {
            paymentQuery = paymentQuery.eq('provider_order_id', rzpOrderId);
          } else if (internalOrderId) {
            paymentQuery = paymentQuery.eq('order_id', internalOrderId);
          }

          // A late failure notification must never downgrade a captured payment.
          paymentQuery = paymentQuery.neq('status', 'captured');
          const { data: updatedPayment, error: paymentError } = await paymentQuery.select('id');
          if (paymentError) throw paymentError;
          if (!updatedPayment?.length) {
            const { data: currentPayment, error: currentPaymentError } = await supabaseAdmin
              .from('payments')
              .select('status, provider_payment_id')
              .eq('provider_order_id', rzpOrderId)
              .maybeSingle();
            if (currentPaymentError) throw currentPaymentError;
            if (currentPayment?.status !== 'captured') {
              throw new Error('Payment failure reconciliation matched no eligible payment');
            }
            // Already captured: treat this stale failure event as reconciled without downgrade.
          }
        }

        // Update webhook event status to 'processed'
        const { error: eventUpdateError } = await supabaseAdmin
          .from('payment_webhook_events')
          .update({
            order_id: internalOrderId || null,
            status: 'processed',
          })
          .eq('event_id', eventId);
        if (eventUpdateError) throw eventUpdateError;
      }

      processedWebhookEventIds.add(eventId);
      res.status(200).json({ status: 'ok', eventId });
    } catch (err: any) {
      console.error('Unhandled error processing Razorpay webhook:', err);
      res.status(500).json({ error: 'Failed to process webhook event.' });
    }
  });

  // -------------------------------------------------------------------
  // 9. POST /api/orders/:id/cancel (CANCEL ORDER & RELEASE RESERVATION)
  // -------------------------------------------------------------------
  app.post(
    '/api/orders/:id/cancel',
    optionalAuthenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;
        if (!id) {
          res.status(400).json({ success: false, error: 'Order ID is required.' });
          return;
        }

        if (!db || !supabaseAdmin || (isProduction && !SUPABASE_SERVICE_ROLE_KEY)) {
          res.status(503).json({ success: false, error: 'Persistent inventory storage is unavailable.' });
          return;
        }
        {
          const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('id, user_id, order_status, shipping_address_snapshot, guest_access_token_hash')
            .eq('id', id)
            .maybeSingle();

          if (orderError) throw new OrderSafetyError('Order storage is unavailable.', 503, orderError.code);
          if (!order) {
            res.status(404).json({ success: false, error: 'Order not found.' });
            return;
          }

          let isAdmin = false;
          if (req.user) {
            const { data: profile, error: profileError } = await supabaseAdmin
              .from('profiles')
              .select('role')
              .eq('id', req.user.id)
              .maybeSingle();
            if (profileError) throw new OrderSafetyError('Account authorization could not be checked.', 503, profileError.code);
            isAdmin = profile?.role === 'admin';
          }

          const auth = verifyOrderAccess(order, req, isAdmin);
          if (!auth.authorized) {
            res.status(auth.statusCode).json({ success: false, error: auth.error });
            return;
          }

          const cancellation = await invokeCheckedRpc(db, 'cancel_order_and_reconcile_inventory', {
            p_order_id: id,
            p_reason: 'Cancelled by customer',
            p_cancelled_by: req.user?.id || null,
          }, 'Order cancellation');

          res.json({ success: true, status: cancellation.status || 'cancelled', refundStatus: cancellation.refund_status || 'not_applicable', message: 'Order cancelled and inventory reconciled.' });
        }
      } catch (err: any) {
        res.status(err instanceof OrderSafetyError ? err.statusCode : 500).json({ success: false, error: err?.message || 'Error cancelling order.' });
      }
    }
  );

  // -------------------------------------------------------------------
  // 10. POST /api/admin/orders/:id/cancel (ADMIN CANCEL & RELEASE)
  // -------------------------------------------------------------------
  app.post(
    '/api/admin/orders/:id/cancel',
    authenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;
        if (!id) {
          res.status(400).json({ success: false, error: 'Order ID is required.' });
          return;
        }
        if (!db || (isProduction && !SUPABASE_SERVICE_ROLE_KEY)) {
          res.status(503).json({ success: false, error: 'Persistent inventory storage is unavailable.' });
          return;
        }
        if (!(await checkAdminRole(req.user?.id))) {
          res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
          return;
        }
        const cancellation = await invokeCheckedRpc(db, 'cancel_order_and_reconcile_inventory', {
          p_order_id: id,
          p_reason: typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : 'Cancelled by admin',
          p_cancelled_by: req.user?.id || null,
        }, 'Order cancellation');
        res.json({ success: true, status: cancellation.status || 'cancelled', refundStatus: cancellation.refund_status || 'not_applicable', message: 'Order cancelled and inventory reconciled.' });
      } catch (err: any) {
        res.status(err instanceof OrderSafetyError ? err.statusCode : 500).json({ success: false, error: err?.message || 'Error cancelling order.' });
      }
    }
  );

  // -------------------------------------------------------------------
  // 11. POST /api/admin/orders/:id/return (ADMIN RETURN & RESTOCK)
  // Production returns must be authorized and committed by PostgreSQL only.
  // Never fall back to in-memory inventory: that would split stock truth.
  // -------------------------------------------------------------------
  app.post(
    '/api/admin/orders/:id/return',
    authenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;
        const { variantId, quantity, reason } = req.body || {};

        if (!(await checkAdminRole(req.user?.id))) {
          res.status(403).json({ success: false, error: 'Administrator access required.' });
          return;
        }
        if (!id || !variantId || !Number.isSafeInteger(quantity) || quantity <= 0) {
          res.status(400).json({ success: false, error: 'Order ID, variant ID and a positive whole quantity are required.' });
          return;
        }
        if (!supabaseAdmin || (isProduction && !SUPABASE_SERVICE_ROLE_KEY)) {
          res.status(503).json({ success: false, error: 'Persistent inventory service is unavailable; no stock was changed.' });
          return;
        }

        const { data, error } = await supabaseAdmin.rpc('return_inventory_for_order_item', {
          p_order_id: id,
          p_product_variant_id: variantId,
          p_quantity: quantity,
          p_reason: typeof reason === 'string' ? reason.slice(0, 500) : 'Customer return restock',
        });
        if (error) {
          console.error('Return inventory RPC failed:', error);
          res.status(503).json({ success: false, error: 'The database could not complete the return. No in-memory stock fallback was used.' });
          return;
        }
        if (!data || data.success !== true) {
          res.status(409).json({ success: false, error: data?.message || data?.error || 'Return was not accepted by the inventory service.' });
          return;
        }
        res.json({ success: true, message: 'Return accepted and inventory updated transactionally.' });
      } catch (err: any) {
        console.error('Admin return failed:', err);
        res.status(500).json({ success: false, error: 'Unable to complete return.' });
      }
    }
  );

  // Helper function to verify admin role across db & test simulation tokens
  async function checkAdminRole(userId: string | undefined): Promise<boolean> {
    if (!userId) return false;
    // Never infer admin privileges from a username, email fragment, or test-token pattern.
    // The sole authorization source is the persisted profiles.role value.
    if (db) {
      try {
        const { data: profile } = await db
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();
        return profile?.role === 'admin';
      } catch {
        return false;
      }
    }
    return false;
  }

  // Helper to log order history / timeline
  async function logOrderHistory(orderId: string, status: string, actor: string, notes?: string, metadata?: any) {
    if (db) {
      try {
        await db.from('order_history').insert({
          order_id: orderId,
          status,
          actor,
          notes: notes || null,
          metadata: metadata || {}
        });
      } catch (e) {
        console.error('Failed to log order history to database:', e);
      }
    }
  }

  const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
    'pending': ['confirmed', 'cancelled'],
    'confirmed': ['packed', 'cancelled'],
    'packed': ['shipped', 'cancelled'],
    'processing': ['shipped', 'cancelled'], // Support processing for compatibility
    'shipped': ['out_for_delivery'],
    'out_for_delivery': ['delivered'],
    'delivered': ['return_requested', 'returned'],
    'return_requested': ['returned'],
    'returned': [],
    'cancelled': [],
    'refunded': []
  };

  function isValidTransition(currentStatus: string, newStatus: string): boolean {
    const current = (currentStatus || 'pending').toLowerCase();
    const next = (newStatus || '').toLowerCase();
    if (current === next) return true;
    const allowed = ALLOWED_STATUS_TRANSITIONS[current] || [];
    return allowed.includes(next);
  }

  // -------------------------------------------------------------------
  // 12. GET /api/admin/orders (ADMIN LIST ORDERS - PAGINATED & FILTERED)
  // -------------------------------------------------------------------
  app.get('/api/admin/notifications/push-config', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    if (!(await checkAdminRole(req.user?.id))) { res.status(403).json({ success: false, error: 'Administrator access required.' }); return; }
    res.json({ enabled: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY), publicKey: process.env.VAPID_PUBLIC_KEY || null });
  });
  app.post('/api/admin/notifications/push-subscription', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!(await checkAdminRole(req.user?.id))) { res.status(403).json({ success: false, error: 'Administrator access required.' }); return; }
      if (!db || !SUPABASE_SERVICE_ROLE_KEY || !req.user?.id) { res.status(503).json({ success: false, error: 'Admin notification storage is unavailable.' }); return; }
      const sub = req.body?.subscription;
      if (typeof sub?.endpoint !== 'string' || !sub.endpoint.startsWith('https://') || typeof sub?.keys?.p256dh !== 'string' || typeof sub?.keys?.auth !== 'string') { res.status(400).json({ success: false, error: 'A valid browser push subscription is required.' }); return; }
      const { error } = await db.from('admin_push_subscriptions').upsert({ admin_user_id: req.user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, enabled: true, updated_at: new Date().toISOString() }, { onConflict: 'endpoint' });
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) { console.error('[admin-push-subscription] save failed:', e?.code || 'error'); res.status(503).json({ success: false, error: 'Could not save admin push subscription.' }); }
  });
  app.delete('/api/admin/notifications/push-subscription', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!(await checkAdminRole(req.user?.id))) { res.status(403).json({ success: false, error: 'Administrator access required.' }); return; }
      const endpoint = String(req.body?.endpoint || '');
      if (!db || !req.user?.id || !endpoint) { res.status(400).json({ success: false, error: 'Subscription endpoint is required.' }); return; }
      const { error } = await db.from('admin_push_subscriptions').update({ enabled: false, updated_at: new Date().toISOString() }).eq('admin_user_id', req.user.id).eq('endpoint', endpoint);
      if (error) throw error;
      res.json({ success: true });
    } catch { res.status(503).json({ success: false, error: 'Could not disable admin push subscription.' }); }
  });

  app.get(
    '/api/admin/orders',
    authenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const isAdmin = await checkAdminRole(req.user?.id);
        if (!isAdmin) {
          res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
          return;
        }

        const {
          search = '',
          orderStatus = 'all',
          paymentStatus = 'all',
          customerType = 'all',
          dateRange = 'all',
          page = '1',
          limit = '10',
          view = 'confirmed',
        } = req.query;

        const pageNum = parseInt(page as string, 10) || 1;
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 10));
        const offset = (pageNum - 1) * limitNum;

        // Order "views" (what the admin should look at):
        //   confirmed (default): paid online orders and Cash on Delivery orders
        //   awaiting: online orders still waiting for payment (stock is on a short hold)
        //   failed:   payment failed / not completed / abandoned (stock already released)
        //   all:      everything
        const applyOrderView = (q: any, which: string) => {
          if (which === 'awaiting') return q.eq('order_status', 'pending').eq('payment_status', 'pending');
          if (which === 'failed') return q.eq('payment_status', 'failed');
          if (which === 'all') return q;
          return q.neq('payment_status', 'failed').or('order_status.neq.pending,payment_status.neq.pending');
        };

        if (db) {
          let query = db
            .from('orders')
            .select(`
              *,
              items:order_items(*),
              payments:payments(id,order_id,provider,provider_order_id,provider_payment_id,amount,currency,status,method,verified_at,created_at)
            `, { count: 'exact' });

          query = applyOrderView(query, String(view));

          if (search) {
            const safeSearch = safePostgrestSearch(search);
            if (safeSearch) {
              const pattern = `%${safeSearch}%`;
              query = query.or(`order_number.ilike.${pattern},customer_name.ilike.${pattern},customer_email.ilike.${pattern},customer_phone.ilike.${pattern}`);
            }
          }

          if (orderStatus !== 'all') {
            query = query.eq('order_status', orderStatus);
          }

          if (paymentStatus !== 'all') {
            query = query.eq('payment_status', paymentStatus);
          }

          if (customerType === 'guest') {
            query = query.eq('is_guest', true);
          } else if (customerType === 'registered') {
            query = query.eq('is_guest', false);
          }

          if (dateRange !== 'all') {
            const now = new Date();
            let startDate = new Date();
            if (dateRange === 'today') {
              startDate.setHours(0, 0, 0, 0);
            } else if (dateRange === 'yesterday') {
              startDate.setDate(startDate.getDate() - 1);
              startDate.setHours(0, 0, 0, 0);
              const endDate = new Date();
              endDate.setHours(0, 0, 0, 0);
              query = query.lte('created_at', endDate.toISOString());
            } else if (dateRange === '7days') {
              startDate.setDate(startDate.getDate() - 7);
            } else if (dateRange === '30days') {
              startDate.setDate(startDate.getDate() - 30);
            }
            query = query.gte('created_at', startDate.toISOString());
          }

          query = query.order('created_at', { ascending: false });
          query = query.range(offset, offset + limitNum - 1);

          const { data, count, error } = await query;
          if (error) {
            res.status(500).json({ success: false, error: error.message });
            return;
          }

          const formattedOrders = (data || []).map((ord: any) => {
            const paymentRecord = Array.isArray(ord.payments) ? ord.payments[0] : ord.payments;
            return {
              id: ord.id,
              orderNumber: ord.order_number,
              userId: ord.user_id,
              customerName: ord.customer_name || ord.shipping_address_snapshot?.recipientName || 'Valued Patron',
              customerEmail: ord.customer_email || ord.shipping_address_snapshot?.email || 'N/A',
              customerPhone: ord.customer_phone || ord.shipping_address_snapshot?.phone || 'N/A',
              isGuest: ord.is_guest,
              shippingAddressSnapshot: ord.shipping_address_snapshot,
              billingAddressSnapshot: ord.billing_address_snapshot,
              subtotal: Number(ord.subtotal),
              discountAmount: Number(ord.discount_amount || 0),
              shippingAmount: Number(ord.shipping_amount || 0),
              taxAmount: Number(ord.tax_amount || 0),
              totalAmount: Number(ord.total_amount),
              currency: ord.currency || 'INR',
              paymentStatus: ord.payment_status,
              orderStatus: ord.order_status,
              refundStatus: ord.refund_status || 'not_applicable',
              cancelledAt: ord.cancelled_at || null,
              cancellationReason: ord.cancellation_reason || '',
              paymentMethod: paymentRecord?.provider === 'cod' ? 'cod' : 'online',
              payment: paymentRecord ? {
                provider: paymentRecord.provider,
                method: paymentRecord.method,
                providerOrderId: paymentRecord.provider_order_id,
                providerPaymentId: paymentRecord.provider_payment_id,
                verifiedAt: paymentRecord.verified_at,
                status: paymentRecord.status,
              } : undefined,
              courierName: ord.courier_name || '',
              trackingNumber: ord.tracking_number || '',
              trackingUrl: ord.tracking_url || '',
              shippedAt: ord.shipped_at || null,
              deliveredAt: ord.delivered_at || null,
              notes: ord.notes || '',
              createdAt: ord.created_at,
              items: (ord.items || []).map((i: any) => ({
                id: i.id,
                productVariantId: i.product_variant_id,
                productName: i.product_name_snapshot,
                sku: i.sku_snapshot,
                price: Number(i.price_snapshot),
                quantity: Number(i.quantity),
                totalAmount: Number(i.total_amount),
                productMetadata: i.product_metadata_snapshot || {},
              })),
              itemsCount: ord.items?.length || 0,
              adminNotes: ord.admin_notes || ''
            };
          });

          // Tab counters for the admin order views.
          const countView = async (which: string): Promise<number> => {
            const { count: viewCount } = await applyOrderView(
              db.from('orders').select('id', { count: 'exact', head: true }),
              which
            );
            return viewCount || 0;
          };
          const [confirmedCount, awaitingCount, failedCount] = await Promise.all([
            countView('confirmed'), countView('awaiting'), countView('failed'),
          ]);

          res.json({
            success: true,
            orders: formattedOrders,
            totalCount: count || 0,
            page: pageNum,
            limit: limitNum,
            view: String(view),
            viewCounts: { confirmed: confirmedCount, awaiting: awaitingCount, failed: failedCount },
          });
        } else {
          let list = Array.from(inMemoryOrdersMap.values());

          if (search) {
            const q = (search as string).toLowerCase();
            list = list.filter(o => 
              (o.order_number || o.orderNumber)?.toLowerCase().includes(q) ||
              o.shipping_address_snapshot?.recipientName?.toLowerCase().includes(q) ||
              o.shipping_address_snapshot?.email?.toLowerCase().includes(q) ||
              o.shipping_address_snapshot?.phone?.toLowerCase().includes(q) ||
              o.customerEmail?.toLowerCase().includes(q) ||
              o.customerName?.toLowerCase().includes(q)
            );
          }

          if (orderStatus !== 'all') {
            list = list.filter(o => (o.order_status || o.orderStatus) === orderStatus);
          }

          if (paymentStatus !== 'all') {
            list = list.filter(o => (o.payment_status || o.paymentStatus) === paymentStatus);
          }

          if (customerType === 'guest') {
            list = list.filter(o => o.shipping_address_snapshot?.isGuest || o.isGuest);
          } else if (customerType === 'registered') {
            list = list.filter(o => !(o.shipping_address_snapshot?.isGuest || o.isGuest));
          }

          if (dateRange !== 'all') {
            const now = Date.now();
            let filterTime = 0;
            if (dateRange === 'today') {
              filterTime = now - 24 * 60 * 60 * 1000;
            } else if (dateRange === '7days') {
              filterTime = now - 7 * 24 * 60 * 60 * 1000;
            } else if (dateRange === '30days') {
              filterTime = now - 30 * 24 * 60 * 60 * 1000;
            }
            list = list.filter(o => new Date(o.created_at || o.createdAt || o.reservation_expires_at).getTime() >= filterTime);
          }

          list.sort((a, b) => b.id.localeCompare(a.id));

          const paginatedList = list.slice(offset, offset + limitNum);
          const formattedOrders = paginatedList.map((ord: any) => ({
            id: ord.id,
            orderNumber: ord.order_number || ord.orderNumber,
            userId: ord.user_id || ord.userId,
            customerName: ord.shipping_address_snapshot?.recipientName || ord.customerName || 'Valued Patron',
            customerEmail: ord.shipping_address_snapshot?.email || ord.customerEmail || 'N/A',
            customerPhone: ord.shipping_address_snapshot?.phone || ord.customerPhone || 'N/A',
            isGuest: ord.shipping_address_snapshot?.isGuest || ord.isGuest || false,
            shippingAddressSnapshot: ord.shipping_address_snapshot,
            billingAddressSnapshot: ord.billing_address_snapshot || ord.shipping_address_snapshot,
            subtotal: Number(ord.subtotal || ord.total_amount),
            discountAmount: Number(ord.discount_amount || 0),
            shippingAmount: Number(ord.shipping_amount || 0),
            taxAmount: Number(ord.tax_amount || 0),
            totalAmount: Number(ord.total_amount),
            currency: ord.currency || 'INR',
            paymentStatus: ord.payment_status || ord.paymentStatus || 'pending',
            orderStatus: ord.order_status || ord.orderStatus || 'pending',
            paymentMethod: ord.paymentMethod || 'online',
            payment: ord.payment,
            courierName: ord.courier_name || ord.courierName || '',
            trackingNumber: ord.tracking_number || ord.trackingNumber || '',
            trackingUrl: ord.tracking_url || ord.trackingUrl || '',
            shippedAt: ord.shipped_at || ord.shippedAt || null,
            deliveredAt: ord.delivered_at || ord.deliveredAt || null,
            cancelledAt: ord.cancelled_at || ord.cancelledAt || null,
            notes: ord.notes || '',
            createdAt: ord.created_at || ord.createdAt || new Date().toISOString(),
            items: (ord.items || []).map((i: any) => ({
              id: i.id,
              productName: i.product_name_snapshot || i.productName || i.name || 'Item',
              sku: i.sku_snapshot || i.sku || '',
              price: Number(i.price_snapshot ?? i.price ?? 0),
              quantity: Number(i.quantity || 1),
              totalAmount: Number(i.total_amount ?? i.totalAmount ?? 0),
              productMetadata: i.product_metadata_snapshot || i.productMetadata || {},
            })),
            itemsCount: ord.items?.length || 1,
            adminNotes: ord.adminNotes || ''
          }));

          res.json({
            success: true,
            orders: formattedOrders,
            totalCount: list.length,
            page: pageNum,
            limit: limitNum
          });
        }
      } catch (err: any) {
        res.status(500).json({ success: false, error: err?.message || 'Error listing orders.' });
      }
    }
  );

  // -------------------------------------------------------------------
  // 13. GET /api/admin/orders/:id (ADMIN VIEW ORDER DETAILS)
  // -------------------------------------------------------------------
  app.get(
    '/api/admin/orders/:id',
    authenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const isAdmin = await checkAdminRole(req.user?.id);
        if (!isAdmin) {
          res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
          return;
        }

        const { id } = req.params;
        if (!id) {
          res.status(400).json({ success: false, error: 'Order ID required.' });
          return;
        }

        if (db) {
          // Do not embed order_history in the orders query: this deployment has
          // no PostgREST relationship for that table, which caused PGRST200 and
          // prevented the entire order drawer from loading.
          const { data: ord, error: ordError } = await db
            .from('orders')
            .select(`
              *,
              items:order_items(*),
              payments:payments(id,order_id,provider,provider_order_id,provider_payment_id,amount,currency,status,method,verified_at,created_at)
            `)
            .eq('id', id)
            .maybeSingle();

          if (ordError) {
            console.error('[admin/orders/:id] database query failed:', ordError);
            res.status(500).json({ success: false, error: 'Unable to load order details. Check the server log for the database query error.' });
            return;
          }
          if (!ord) {
            res.status(404).json({ success: false, error: 'Order not found.' });
            return;
          }

          // Timeline is best-effort. Some deployments don't have an order_history
          // table yet; that must not block the order/customer/payment details.
          let orderHistory: any[] = [];
          const { data: historyRows, error: historyError } = await db
            .from('order_history')
            .select('*')
            .eq('order_id', id)
            .order('created_at', { ascending: true });
          if (!historyError && Array.isArray(historyRows)) {
            orderHistory = historyRows;
          } else if (historyError && historyError.code !== '42P01' && historyError.code !== 'PGRST205') {
            console.warn('[admin/orders/:id] order history unavailable; loading order without timeline:', historyError.message);
          }

          const paymentRecord = Array.isArray(ord.payments) ? ord.payments[0] : ord.payments;
          const orderData = {
            id: ord.id,
            orderNumber: ord.order_number,
            userId: ord.user_id,
            customerName: ord.customer_name || ord.shipping_address_snapshot?.recipientName || 'Valued Patron',
            customerEmail: ord.customer_email || ord.shipping_address_snapshot?.email || 'N/A',
            customerPhone: ord.customer_phone || ord.shipping_address_snapshot?.phone || 'N/A',
            isGuest: ord.is_guest,
            shippingAddressSnapshot: ord.shipping_address_snapshot,
            billingAddressSnapshot: ord.billing_address_snapshot,
            subtotal: Number(ord.subtotal),
            discountAmount: Number(ord.discount_amount || 0),
            shippingAmount: Number(ord.shipping_amount || 0),
            taxAmount: Number(ord.tax_amount || 0),
            totalAmount: Number(ord.total_amount),
            currency: ord.currency || 'INR',
            paymentStatus: ord.payment_status,
            orderStatus: ord.order_status,
            refundStatus: ord.refund_status || 'not_applicable',
            cancelledAt: ord.cancelled_at || null,
            cancellationReason: ord.cancellation_reason || '',
            courierName: ord.courier_name || '',
            trackingNumber: ord.tracking_number || '',
            trackingUrl: ord.tracking_url || '',
            shippedAt: ord.shipped_at || null,
            deliveredAt: ord.delivered_at || null,
            paymentMethod: paymentRecord?.provider === 'cod' ? 'cod' : 'online',
            payment: paymentRecord ? {
              id: paymentRecord.id,
              orderId: paymentRecord.order_id,
              provider: paymentRecord.provider,
              providerOrderId: paymentRecord.provider_order_id,
              providerPaymentId: paymentRecord.provider_payment_id,
              providerSignature: paymentRecord.provider_signature,
              amount: Number(paymentRecord.amount),
              currency: paymentRecord.currency,
              status: paymentRecord.status,
              method: paymentRecord.method,
              errorReason: paymentRecord.error_reason,
              verifiedAt: paymentRecord.verified_at,
              createdAt: paymentRecord.created_at,
            } : undefined,
            notes: ord.notes,
            adminNotes: ord.admin_notes || '',
            createdAt: ord.created_at,
            items: (ord.items || []).map((i: any) => ({
              id: i.id,
              productVariantId: i.product_variant_id,
              productName: i.product_name_snapshot,
              sku: i.sku_snapshot,
              price: Number(i.price_snapshot),
              quantity: i.quantity,
              totalAmount: Number(i.total_amount),
              productMetadata: i.product_metadata_snapshot || {},
              primaryImage: i.product_metadata_snapshot?.primaryImage || '',
            })),
            timeline: orderHistory.map((h: any) => ({
              id: h.id,
              status: h.status,
              actor: h.actor,
              notes: h.notes,
              metadata: h.metadata,
              createdAt: h.created_at
            }))
          };

          res.json({ success: true, order: orderData });
        } else {
          const ord = inMemoryOrdersMap.get(id);
          if (!ord) {
            res.status(404).json({ success: false, error: 'Order not found.' });
            return;
          }

          const orderData = {
            id: ord.id,
            orderNumber: ord.order_number || ord.orderNumber,
            userId: ord.user_id || ord.userId,
            customerName: ord.shipping_address_snapshot?.recipientName || ord.customerName || 'Valued Patron',
            customerEmail: ord.shipping_address_snapshot?.email || ord.customerEmail || 'N/A',
            customerPhone: ord.shipping_address_snapshot?.phone || ord.customerPhone || 'N/A',
            isGuest: ord.shipping_address_snapshot?.isGuest || ord.isGuest || false,
            shippingAddressSnapshot: ord.shipping_address_snapshot,
            billingAddressSnapshot: ord.billing_address_snapshot || ord.shipping_address_snapshot,
            subtotal: Number(ord.subtotal || ord.total_amount),
            discountAmount: Number(ord.discount_amount || 0),
            shippingAmount: Number(ord.shipping_amount || 0),
            taxAmount: Number(ord.tax_amount || 0),
            totalAmount: Number(ord.total_amount),
            currency: ord.currency || 'INR',
            paymentStatus: ord.payment_status || ord.paymentStatus || 'pending',
            orderStatus: ord.order_status || ord.orderStatus || 'pending',
            paymentMethod: ord.paymentMethod || 'online',
            notes: ord.notes || '',
            adminNotes: ord.adminNotes || '',
            createdAt: ord.created_at || ord.createdAt || new Date().toISOString(),
            items: (ord.items || []).map((i: any) => ({
              productVariantId: i.variantId || i.productVariantId,
              productName: i.productName || (i.product?.name) || 'Loom product',
              sku: i.sku || (i.product?.sku) || 'SKU-VK',
              price: Number(i.price || (i.product?.price) || 0),
              quantity: i.quantity,
              totalAmount: Number(i.totalAmount || ((i.price || i.product?.price || 0) * i.quantity)),
              primaryImage: i.primaryImage || i.product?.primaryImage || '',
              productMetadata: i.productMetadata || {}
            })),
            timeline: ord.timeline || [
              {
                id: '1',
                status: 'Order Created',
                actor: 'Customer',
                notes: 'Order initiated with reservation',
                createdAt: ord.created_at || ord.createdAt || new Date().toISOString()
              }
            ]
          };

          res.json({ success: true, order: orderData });
        }
      } catch (err: any) {
        res.status(500).json({ success: false, error: err?.message || 'Error fetching order.' });
      }
    }
  );

  // -------------------------------------------------------------------
  // PATCH /api/admin/orders/:id/shipment (MANUAL COURIER TRACKING)
  // Requires the additive migration 202610120001_add_manual_courier_tracking.sql.
  // -------------------------------------------------------------------
  app.patch('/api/admin/orders/:id/shipment', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!(await checkAdminRole(req.user?.id))) { res.status(403).json({ success: false, error: 'Admin access required.' }); return; }
      if (!db) { res.status(503).json({ success: false, error: 'Database service unavailable.' }); return; }
      const id = String(req.params.id || '');
      const courierName = String(req.body?.courierName || '').trim().slice(0, 120);
      const trackingNumber = String(req.body?.trackingNumber || '').trim().slice(0, 120);
      const trackingUrl = String(req.body?.trackingUrl || '').trim().slice(0, 1000);
      if (trackingUrl) {
        let parsed: URL;
        try { parsed = new URL(trackingUrl); } catch { res.status(400).json({ success: false, error: 'Tracking URL must be a valid HTTPS/HTTP URL.' }); return; }
        if (!['https:', 'http:'].includes(parsed.protocol)) { res.status(400).json({ success: false, error: 'Tracking URL must use HTTPS or HTTP.' }); return; }
      }
      const { data: existing, error: readError } = await db.from('orders').select('id, order_status, shipped_at, delivered_at').eq('id', id).maybeSingle();
      if (readError) throw readError;
      if (!existing) { res.status(404).json({ success: false, error: 'Order not found.' }); return; }
      const update: Record<string, any> = { courier_name: courierName || null, tracking_number: trackingNumber || null, tracking_url: trackingUrl || null };
      // Shipment timestamps are immutable event times; editing tracking metadata must not rewrite them.
      if ((existing.order_status === 'shipped' || existing.order_status === 'out_for_delivery') && !existing.shipped_at) update.shipped_at = new Date().toISOString();
      if (existing.order_status === 'delivered' && !existing.delivered_at) update.delivered_at = new Date().toISOString();
      const { error: updateError } = await db.from('orders').update(update).eq('id', id);
      if (updateError) throw updateError;
      res.json({ success: true, message: 'Courier tracking details saved.' });
    } catch (err: any) {
      console.error('[admin/orders/:id/shipment] update failed:', err);
      res.status(500).json({ success: false, error: 'Unable to save courier tracking. Confirm the courier migration has been applied.' });
    }
  });

  // -------------------------------------------------------------------
  // POST /api/admin/orders/:id/payment-status (MANUAL COD COLLECTION LEDGER)
  // -------------------------------------------------------------------
  app.post('/api/admin/orders/:id/payment-status', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!(await checkAdminRole(req.user?.id))) {
        res.status(403).json({ success: false, error: 'Administrator access required.' });
        return;
      }
      if (!db || (isProduction && !SUPABASE_SERVICE_ROLE_KEY)) {
        res.status(503).json({ success: false, error: 'Persistent payment storage is unavailable.' });
        return;
      }
      const id = String(req.params.id || '');
      const nextStatus = String(req.body?.paymentStatus || '').trim().toLowerCase();
      const notes = typeof req.body?.notes === 'string' ? req.body.notes.slice(0, 500) : null;
      const result = await invokeCheckedRpc(db, 'record_cod_payment_progress', {
        p_order_id: id,
        p_next_status: nextStatus,
        p_actor: req.user?.email || 'Administrator',
        p_notes: notes,
      }, 'COD payment update');
      res.json({ success: true, message: `COD payment marked ${nextStatus.replace('_', ' ')}.`, paymentStatus: result.payment_status });
    } catch (err: any) {
      res.status(err instanceof OrderSafetyError ? err.statusCode : 409).json({ success: false, error: err?.message || 'Unable to update COD payment status.' });
    }
  });

  // -------------------------------------------------------------------
  // POST /api/admin/orders/:id/refund-status (MANUAL REFUND LEDGER)
  // This records a verified refund action; it never initiates a payment-provider refund.
  // -------------------------------------------------------------------
  app.post('/api/admin/orders/:id/refund-status', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!(await checkAdminRole(req.user?.id))) {
        res.status(403).json({ success: false, error: 'Administrator access required.' });
        return;
      }
      if (!db || (isProduction && !SUPABASE_SERVICE_ROLE_KEY)) {
        res.status(503).json({ success: false, error: 'Persistent payment storage is unavailable.' });
        return;
      }
      const id = String(req.params.id || '');
      const refundStatus = String(req.body?.refundStatus || '').trim().toLowerCase();
      const notes = typeof req.body?.notes === 'string' ? req.body.notes.slice(0, 500) : null;
      const result = await invokeCheckedRpc(db, 'update_order_refund_status', {
        p_order_id: id,
        p_next_status: refundStatus,
        p_actor: req.user?.email || 'Administrator',
        p_notes: notes,
      }, 'Refund status update');
      res.json({ success: true, message: `Refund workflow marked ${refundStatus}.`, refundStatus: result.refund_status });
    } catch (err: any) {
      res.status(err instanceof OrderSafetyError ? err.statusCode : 409).json({ success: false, error: err?.message || 'Unable to update refund status.' });
    }
  });

  // -------------------------------------------------------------------
  // 14. POST /api/admin/orders/:id/status (ADMIN UPDATE STATUS - STATE MACHINE CONTROLLED)
  // -------------------------------------------------------------------
  app.post(
    '/api/admin/orders/:id/status',
    authenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const isAdmin = await checkAdminRole(req.user?.id);
        if (!isAdmin) {
          res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
          return;
        }

        const { id } = req.params;
        const { orderStatus, paymentStatus, notes } = req.body;

        if (!id || !orderStatus) {
          res.status(400).json({ success: false, error: 'Order ID and new orderStatus are required.' });
          return;
        }

        let currentOrderStatus = 'pending';
        let currentPaymentStatus = 'pending';
        let currentCourierName = '';
        let currentShippedAt: string | null = null;
        let currentDeliveredAt: string | null = null;
        let cancellationCommitted = false;

        if (db) {
          const { data: ord, error: ordError } = await db
            .from('orders')
            .select('order_status, payment_status, courier_name, shipped_at, delivered_at')
            .eq('id', id)
            .maybeSingle();

          if (ordError) {
            console.error('[admin/order-status] required order columns unavailable:', { code: ordError.code, message: ordError.message });
            const migrationHint = ['42703', 'PGRST204', 'PGRST200'].includes(String(ordError.code || ''))
              ? ' Apply Supabase migrations 202610120001_add_manual_courier_tracking.sql, 202610120002_order_status_enum_compat.sql, 202610120003_manual_lifecycle_cancellation.sql, and the latest VK VASTRAM migration.'
              : '';
            res.status(503).json({ success: false, error: `Order storage is unavailable.${migrationHint}` });
            return;
          }
          if (!ord) {
            res.status(404).json({ success: false, error: 'Order not found.' });
            return;
          }
          currentOrderStatus = ord.order_status;
          currentPaymentStatus = ord.payment_status;
          currentCourierName = String(ord.courier_name || '').trim();
          currentShippedAt = ord.shipped_at || null;
          currentDeliveredAt = ord.delivered_at || null;
        } else {
          const ord = inMemoryOrdersMap.get(id);
          if (!ord) {
            res.status(404).json({ success: false, error: 'Order not found.' });
            return;
          }
          currentOrderStatus = ord.order_status || ord.orderStatus || 'pending';
          currentPaymentStatus = ord.payment_status || ord.paymentStatus || 'pending';
          currentCourierName = String(ord.courier_name || ord.courierName || '').trim();
          currentShippedAt = ord.shipped_at || ord.shippedAt || null;
          currentDeliveredAt = ord.delivered_at || ord.deliveredAt || null;
        }

        if (!isValidTransition(currentOrderStatus, orderStatus)) {
          res.status(400).json({
            success: false,
            error: `Invalid transition from "${currentOrderStatus}" to "${orderStatus}". Status flow must follow: Pending -> Confirmed -> Packed -> Shipped -> Out for Delivery -> Delivered.`
          });
          return;
        }

        if (orderStatus === 'shipped' && !currentCourierName) {
          res.status(409).json({ success: false, error: 'Assign and save a courier partner before marking this order as Shipped. A tracking number or URL is optional for local delivery.' });
          return;
        }

        if (orderStatus === 'cancelled' && currentOrderStatus !== 'cancelled') {
          if (!db || (isProduction && !SUPABASE_SERVICE_ROLE_KEY)) {
            res.status(503).json({ success: false, error: 'Persistent inventory storage is unavailable. Order was not cancelled.' });
            return;
          }

          await invokeCheckedRpc(db, 'cancel_order_and_reconcile_inventory', {
            p_order_id: id,
            p_reason: notes || 'Cancelled by administrator',
            p_cancelled_by: req.user?.id || null,
          }, 'Order cancellation');
          cancellationCommitted = true;
        }

        const actorName = req.user?.email || 'Admin';
        const timelineNotes = notes || `Status updated from "${currentOrderStatus}" to "${orderStatus}" by ${actorName}`;

        if (db) {
          if (cancellationCommitted) {
            // Cancellation and inventory release were committed together by one database RPC.
          } else {
          const updatePayload: any = {
            order_status: orderStatus,
            updated_at: new Date().toISOString()
          };
          if (orderStatus === 'shipped' && !currentShippedAt) updatePayload.shipped_at = new Date().toISOString();
          if (orderStatus === 'delivered' && !currentDeliveredAt) updatePayload.delivered_at = new Date().toISOString();
          if (orderStatus === 'returned' && ['captured', 'cod_collected', 'cod_settled'].includes(String(currentPaymentStatus))) {
            updatePayload.refund_status = 'pending';
          }
          if (paymentStatus) {
            updatePayload.payment_status = paymentStatus;
          }

          const { error: updateError } = await db
            .from('orders')
            .update(updatePayload)
            .eq('id', id);

          if (updateError) {
            res.status(500).json({ success: false, error: updateError.message });
            return;
          }

          await logOrderHistory(id, `Order ${orderStatus.toUpperCase()}`, actorName, timelineNotes, {
            previous_status: currentOrderStatus,
            new_status: orderStatus,
            payment_status_updated: paymentStatus ? true : false,
            previous_payment_status: currentPaymentStatus,
            new_payment_status: paymentStatus || currentPaymentStatus
          });
          }
        } else {
          const ord = inMemoryOrdersMap.get(id);
          ord.order_status = orderStatus;
          if (orderStatus === 'shipped' && !currentShippedAt) ord.shipped_at = new Date().toISOString();
          if (orderStatus === 'delivered' && !currentDeliveredAt) ord.delivered_at = new Date().toISOString();
          if (paymentStatus) {
            ord.payment_status = paymentStatus;
          }
          ord.timeline = ord.timeline || [];
          ord.timeline.push({
            id: `event-${Date.now()}`,
            status: `Order ${orderStatus.toUpperCase()}`,
            actor: actorName,
            notes: timelineNotes,
            createdAt: new Date().toISOString()
          });
          inMemoryOrdersMap.set(id, ord);
        }

        void dispatchAdminOrderAlert(id, 'status_update', String(orderStatus));
        res.json({
          success: true,
          message: `Order status successfully transitioned to "${orderStatus}".`,
          orderStatus,
          paymentStatus: paymentStatus || currentPaymentStatus
        });
      } catch (err: any) {
        res.status(err instanceof OrderSafetyError ? err.statusCode : 500).json({ success: false, error: err?.message || 'Error updating order status.' });
      }
    }
  );

  // -------------------------------------------------------------------
  // 15. POST /api/admin/orders/:id/notes (ADMIN UPDATE INTERNAL NOTES)
  // -------------------------------------------------------------------
  app.post(
    '/api/admin/orders/:id/notes',
    authenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const isAdmin = await checkAdminRole(req.user?.id);
        if (!isAdmin) {
          res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
          return;
        }

        const { id } = req.params;
        const { notes } = req.body;

        if (!id) {
          res.status(400).json({ success: false, error: 'Order ID is required.' });
          return;
        }

        if (db) {
          const { error: updateError } = await db
            .from('orders')
            .update({ admin_notes: notes, updated_at: new Date().toISOString() })
            .eq('id', id);

          if (updateError) {
            res.status(500).json({ success: false, error: updateError.message });
            return;
          }

          await logOrderHistory(id, 'Admin Notes Updated', req.user?.email || 'Admin', 'Internal administrative notes were updated.', {});
        } else {
          const ord = inMemoryOrdersMap.get(id);
          if (!ord) {
            res.status(404).json({ success: false, error: 'Order not found.' });
            return;
          }
          ord.adminNotes = notes;
          ord.timeline = ord.timeline || [];
          ord.timeline.push({
            id: `event-${Date.now()}`,
            status: 'Admin Notes Updated',
            actor: req.user?.email || 'Admin',
            notes: 'Internal administrative notes were updated.',
            createdAt: new Date().toISOString()
          });
          inMemoryOrdersMap.set(id, ord);
        }

        res.json({ success: true, message: 'Internal admin notes successfully updated.' });
      } catch (err: any) {
        res.status(500).json({ success: false, error: err?.message || 'Error updating administrative notes.' });
      }
    }
  );

  // -------------------------------------------------------------------
  // 16. REVIEWS CONTROLLER - CLIENT & ADMIN API ENDPOINTS
  // -------------------------------------------------------------------

  // GET /api/products/:productId/reviews (PUBLIC GET APPROVED REVIEWS)
  app.get('/api/products/:productId/reviews', async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;
      const { limit = '10', offset = '0' } = req.query;
      const limitNum = parseInt(limit as string, 10) || 10;
      const offsetNum = parseInt(offset as string, 10) || 0;

      if (db) {
        // Query approved reviews from Supabase and join profiles
        const { data, count, error } = await db
          .from('reviews')
          .select(`
            id,
            product_id,
            user_id,
            rating,
            title,
            body,
            review_images,
            status,
            created_at
          `, { count: 'exact' })
          .eq('product_id', productId)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .range(offsetNum, offsetNum + limitNum - 1);

        if (error) {
          res.status(500).json({ success: false, error: error.message });
          return;
        }

        const formatted = (data || []).map((rev: any) => ({
          id: rev.id,
          productId: rev.product_id,
          userId: rev.user_id,
          rating: rev.rating,
          title: rev.title,
          body: rev.body,
          reviewImages: Array.isArray(rev.review_images) ? rev.review_images : [],
          status: rev.status,
          verifiedPurchase: true,
          createdAt: rev.created_at,
          reviewerName: 'Verified Patron'
        }));

        res.json({ success: true, reviews: formatted, totalCount: count || 0 });
      } else {
        const list = Array.from(inMemoryReviewsMap.values())
          .filter((rev: any) => rev.productId === productId && rev.status === 'approved')
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        const paginated = list.slice(offsetNum, offsetNum + limitNum);
        res.json({ success: true, reviews: paginated, totalCount: list.length });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Error loading reviews.' });
    }
  });

  // POST /api/back-in-stock/subscribe (AUTHENTICATED CUSTOMER RESTOCK REQUEST)
  app.post('/api/back-in-stock/subscribe', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!db) { res.status(503).json({ success: false, error: 'Restock notification storage is unavailable.' }); return; }
      const userId = req.user?.id;
      const email = String(req.user?.email || '').trim().toLowerCase();
      const productId = String(req.body?.productId || '').trim();
      const variantId = String(req.body?.variantId || '').trim();
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!userId || !uuid.test(userId) || !email || !uuid.test(productId) || !uuid.test(variantId)) {
        res.status(400).json({ success: false, error: 'Sign in to a verified customer account before requesting a restock alert.' }); return;
      }
      const { data: variant, error: variantError } = await db.from('product_variants')
        .select('id,product_id,stock_quantity,reserved_quantity,is_active')
        .eq('id', variantId).eq('product_id', productId).maybeSingle();
      if (variantError) throw variantError;
      if (!variant) { res.status(404).json({ success: false, error: 'This product variant could not be found.' }); return; }
      if (variant.is_active && Number(variant.stock_quantity || 0) - Number(variant.reserved_quantity || 0) > 0) {
        res.json({ success: true, alreadyAvailable: true }); return;
      }
      const { error: upsertError } = await db.from('back_in_stock_subscriptions').upsert({
        user_id: userId, product_id: productId, product_variant_id: variantId, email,
        status: 'pending', updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,product_variant_id' });
      if (upsertError) throw upsertError;
      res.status(201).json({ success: true, emailDeliveryConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL && (process.env.SITE_URL || process.env.APP_URL)), message: 'Restock request saved.' });
    } catch (err: any) {
      console.error('[back-in-stock/subscribe] failed:', err?.code, err?.message);
      res.status(503).json({ success: false, error: 'Unable to save your restock request right now. Please try again shortly.' });
    }
  });

  // POST /api/reviews/upload-image — authenticated review photo upload, only for delivered purchases.
  app.post('/api/reviews/upload-image', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const dataUrl = String(req.body?.dataUrl || '');
      const productId = String(req.body?.productId || '');
      const contentType = String(req.body?.contentType || '');
      if (!userId || !db) { res.status(503).json({ success: false, error: 'Review photo storage is unavailable.' }); return; }
      if (!productId) { res.status(400).json({ success: false, error: 'Product is required for review photo upload.' }); return; }
      const { data: productVariants } = await db.from('product_variants').select('id').eq('product_id', productId);
      const purchasedVariantIds = (productVariants || []).map((v: any) => v.id);
      const { data: deliveredOrders } = await db.from('orders').select('id,items:order_items(product_variant_id)').eq('user_id', userId).eq('order_status', 'delivered');
      const eligible = (deliveredOrders || []).some((order: any) => (order.items || []).some((item: any) => purchasedVariantIds.includes(item.product_variant_id)));
      if (!eligible) { res.status(403).json({ success: false, error: 'Review photos are available only for products from delivered orders.' }); return; }
      const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (!match || match[1] !== contentType) { res.status(400).json({ success: false, error: 'Unsupported review image format.' }); return; }
      const buffer = Buffer.from(match[2], 'base64');
      if (!buffer.length || buffer.length > 5 * 1024 * 1024) { res.status(413).json({ success: false, error: 'Review photos must be 5 MB or smaller.' }); return; }
      if (!hasImageSignature(buffer, contentType)) { res.status(400).json({ success: false, error: 'The uploaded file content does not match a supported image format.' }); return; }
      // Eligibility is checked again when the review is submitted. Uploads are private-by-convention paths in the existing public assets bucket.
      const extension = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : 'webp';
      const objectPath = `reviews/${userId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await db.storage.from('store-assets').upload(objectPath, buffer, { contentType, upsert: false });
      if (uploadError) { res.status(500).json({ success: false, error: 'Could not store review photo. Check store-assets storage configuration.' }); return; }
      const { data: publicData } = db.storage.from('store-assets').getPublicUrl(objectPath);
      res.json({ success: true, url: publicData.publicUrl });
    } catch (error) { console.error('[reviews] photo upload failed'); res.status(500).json({ success: false, error: 'Review photo upload failed.' }); }
  });

  // POST /api/reviews/submit (CUSTOMER SUBMIT ELIGIBLE REVIEW)
  app.post('/api/reviews/submit', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { productId, rating, title, body } = req.body;
      const reviewImages = Array.isArray(req.body?.reviewImages) ? req.body.reviewImages.filter((url: unknown) => typeof url === 'string' && /^https:\/\/[^ ]+\/storage\/v1\/object\/public\/store-assets\/reviews\//.test(url)).slice(0, 5) : [];
      const userId = req.user?.id;

      if (!productId || !rating || rating < 1 || rating > 5) {
        res.status(400).json({ success: false, error: 'Product ID and valid rating (1-5) are required.' });
        return;
      }

      if (db) {
        // 1. Fetch product variants of this product to see if user has purchased any
        const { data: variants, error: variantsError } = await db
          .from('product_variants')
          .select('id')
          .eq('product_id', productId);

        if (variantsError || !variants) {
          res.status(500).json({ success: false, error: 'Error validating product catalog.' });
          return;
        }

        const variantIds = variants.map((v: any) => v.id);

        // 2. Query delivered orders containing these variants
        const { data: orders, error: ordersError } = await db
          .from('orders')
          .select(`
            id,
            order_number,
            items:order_items(product_variant_id)
          `)
          .eq('user_id', userId)
          .eq('order_status', 'delivered');

        if (ordersError) {
          res.status(500).json({ success: false, error: ordersError.message });
          return;
        }

        // Check if any delivered order item variant ID matches the product's variants
        const matchingOrder = orders?.find((ord: any) =>
          ord.items?.some((item: any) => variantIds.includes(item.product_variant_id))
        );

        if (!matchingOrder) {
          res.status(403).json({
            success: false,
            error: 'Eligibility Required: You can only submit reviews for handloom textiles you have purchased and received delivery for.'
          });
          return;
        }

        // 3. Prevent duplicates: check if review already exists
        const { data: existing, error: dupError } = await db
          .from('reviews')
          .select('id')
          .eq('user_id', userId)
          .eq('product_id', productId)
          .maybeSingle();

        if (dupError) {
          res.status(500).json({ success: false, error: 'Could not check your existing review. Please try again.' });
          return;
        }

        // If an earlier version saved the review as pending, publish that same
        // review after re-verifying the delivered purchase instead of telling the
        // customer it exists while hiding it from the public product page.
        const reviewPayload = {
          order_id: matchingOrder.id,
          rating: Number(rating),
          title: String(title || '').trim(),
          body: String(body || '').trim(),
          review_images: reviewImages,
          status: 'approved',
          verified_purchase: true,
          moderation_metadata: {
            submit_ip: req.ip,
            user_agent: req.headers['user-agent'],
            order_number: matchingOrder.order_number,
            published_after_delivery_verification: true
          },
          updated_at: new Date().toISOString()
        };

        if (existing) {
          const { error: updateError } = await db
            .from('reviews')
            .update(reviewPayload)
            .eq('id', existing.id)
            .eq('user_id', userId)
            .eq('product_id', productId);
          if (updateError) {
            res.status(500).json({ success: false, error: 'Your existing review was found but could not be published. Please contact support.' });
            return;
          }
        } else {
          const { error: insertError } = await db
            .from('reviews')
            .insert({ product_id: productId, user_id: userId, ...reviewPayload, created_at: new Date().toISOString() });
          if (insertError) {
            res.status(500).json({ success: false, error: insertError.message });
            return;
          }
        }

        res.json({ success: true, message: 'Thank you! Your verified review is now published on the product page.' });
      } else {
        // Local simulation fallback
        // Find delivered order in inMemoryOrdersMap
        const list = Array.from(inMemoryOrdersMap.values());
        const hasDeliveredOrder = list.some(o =>
          (o.user_id === userId || o.userId === userId) &&
          (o.order_status === 'delivered' || o.orderStatus === 'delivered')
        );

        if (!hasDeliveredOrder) {
          res.status(403).json({
            success: false,
            error: 'Eligibility Required: You can only submit reviews for handloom textiles you have purchased and received delivery for.'
          });
          return;
        }

        const reviewKey = `${userId}-${productId}`;
        if (inMemoryReviewsMap.has(reviewKey)) {
          res.status(400).json({ success: false, error: 'You have already submitted a review for this textile masterpiece.' });
          return;
        }

        const reviewId = `rev-${Date.now()}`;
        inMemoryReviewsMap.set(reviewKey, {
          id: reviewId,
          productId,
          userId,
          rating,
          title: title || '',
          body: body || '',
          status: 'approved',
          verifiedPurchase: true,
          createdAt: new Date().toISOString(),
          reviewerName: req.user?.email ? req.user.email.split('@')[0] : 'Verified Patron'
        });

        res.json({ success: true, message: 'Thank you! Your verified review is now published on the product page.' });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Error submitting review.' });
    }
  });

  // GET /api/admin/reviews (ADMIN LOAD ALL REVIEWS FOR MODERATION)
  app.get('/api/admin/reviews', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const isAdmin = await checkAdminRole(req.user?.id);
      if (!isAdmin) {
        res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
        return;
      }

      if (db) {
        const { data, error } = await db
          .from('reviews')
          .select(`
            *,
            profile:profiles(fullName, email),
            product:products(name)
          `)
          .order('created_at', { ascending: false });

        if (error) {
          res.status(500).json({ success: false, error: error.message });
          return;
        }

        const formatted = (data || []).map((r: any) => ({
          id: r.id,
          productId: r.product_id,
          productName: r.product?.name || 'Unknown Saree',
          userId: r.user_id,
          reviewerName: r.profile?.fullName || 'Verified Customer',
          reviewerEmail: r.profile?.email || 'N/A',
          rating: r.rating,
          title: r.title,
          body: r.body,
          status: r.status,
          verifiedPurchase: r.verified_purchase,
          createdAt: r.created_at,
          moderationMetadata: r.moderation_metadata || {}
        }));

        res.json({ success: true, reviews: formatted });
      } else {
        const formatted = Array.from(inMemoryReviewsMap.values()).map(r => ({
          ...r,
          reviewerEmail: r.userId + '@vkvastram.com',
          productName: 'Royal Banarasi Silk Saree',
          moderationMetadata: {}
        }));
        res.json({ success: true, reviews: formatted });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Error retrieving admin reviews.' });
    }
  });

  // POST /api/admin/reviews/:id/status (ADMIN MODERATE STATUS UPDATE)
  app.post('/api/admin/reviews/:id/status', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const isAdmin = await checkAdminRole(req.user?.id);
      if (!isAdmin) {
        res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
        return;
      }

      const { id } = req.params;
      const { status, moderationNotes } = req.body;

      if (!status || !['pending', 'approved', 'rejected', 'hidden'].includes(status)) {
        res.status(400).json({ success: false, error: 'Valid status is required.' });
        return;
      }

      if (db) {
        // Fetch current review metadata to append moderation history
        const { data: review } = await db
          .from('reviews')
          .select('moderation_metadata')
          .eq('id', id)
          .maybeSingle();

        const metadata = review?.moderation_metadata || {};
        metadata.moderation = {
          actor: req.user?.email || 'Admin',
          action: status,
          date: new Date().toISOString(),
          notes: moderationNotes || ''
        };

        const { error } = await db
          .from('reviews')
          .update({
            status,
            moderation_metadata: metadata,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (error) {
          res.status(500).json({ success: false, error: error.message });
          return;
        }

        res.json({ success: true, message: `Review successfully updated to "${status}".` });
      } else {
        // Fallback update
        let found = false;
        const entries = Array.from(inMemoryReviewsMap.entries());
        for (const [key, val] of entries) {
          if (val.id === id) {
            val.status = status;
            inMemoryReviewsMap.set(key, val);
            found = true;
            break;
          }
        }

        if (!found) {
          res.status(404).json({ success: false, error: 'Review not found.' });
          return;
        }

        res.json({ success: true, message: `Review successfully updated to "${status}".` });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Error moderating review.' });
    }
  });

  // -------------------------------------------------------------------
  // ADMIN INVENTORY MANAGEMENT & AUDIT LEDGER ENDPOINTS
  // -------------------------------------------------------------------
  const inMemoryMovementsList: any[] = [
    {
      id: 'mov-1',
      product_variant_id: 'var-1',
      movement_type: 'purchase',
      quantity: 12,
      notes: 'Initial Loom Procurement Batch - Varanasi',
      created_by: 'mama@vkvastram.com',
      created_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'mov-2',
      product_variant_id: 'var-2',
      movement_type: 'purchase',
      quantity: 5,
      notes: 'Kanjivaram Factory Shipment',
      created_by: 'mama@vkvastram.com',
      created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    },
  ];
  const inMemoryThresholdsMap = new Map<string, number>();

  // GET /api/admin/inventory (AUTHORITATIVE STOCK LEDGER & SUMMARY)
  app.get('/api/admin/inventory', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const isAdmin = await checkAdminRole(req.user?.id);
      if (!isAdmin) {
        res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
        return;
      }

      let ledgerItems: any[] = [];

      if (db) {
        const { data: variants, error: varError } = await db
          .from('product_variants')
          .select(`
            *,
            product:products(id, name, slug, price, category:categories(name, slug), images:product_images(image_url, is_primary))
          `)
          .order('stock_quantity', { ascending: true });

        if (!varError && variants) {
          // Fetch sold quantities from confirmed order_items
          const { data: soldRows } = await db
            .from('order_items')
            .select('product_variant_id, quantity');

          const soldMap = new Map<string, number>();
          if (soldRows) {
            for (const r of soldRows) {
              if (r.product_variant_id) {
                soldMap.set(
                  r.product_variant_id,
                  (soldMap.get(r.product_variant_id) || 0) + (Number(r.quantity) || 0)
                );
              }
            }
          }

          ledgerItems = variants.map((v: any) => {
            const stock = Number(v.stock_quantity) || 0;
            const reserved = Number(v.reserved_quantity) || 0;
            const available = Math.max(0, stock - reserved);
            const sold = soldMap.get(v.id) || 0;
            const threshold = Number(v.low_stock_threshold) || inMemoryThresholdsMap.get(v.id) || 5;

            let status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
            if (available <= 0) {
              status = 'out_of_stock';
            } else if (available < threshold) {
              status = 'low_stock';
            }

            const p = v.product;
            const primaryImg =
              p?.images?.find((i: any) => i.is_primary)?.image_url ||
              p?.images?.[0]?.image_url ||
              '';

            return {
              variantId: v.id,
              productId: p?.id || v.product_id,
              productName: p?.name || 'Handloom Item',
              categoryLabel: p?.category?.name || 'Textiles',
              sku: v.sku || `SKU-${v.id.slice(0, 8)}`,
              variantName: v.variant_name || 'Standard',
              color: v.color || undefined,
              size: v.size || v.bed_size || v.dimensions || undefined,
              stockQuantity: stock,
              reservedQuantity: reserved,
              soldQuantity: sold,
              availableQuantity: available,
              lowStockThreshold: threshold,
              status,
              updatedAt: v.updated_at || new Date().toISOString(),
              price: Number(v.price_override || p?.price || 0),
              imageUrl: primaryImg,
            };
          });
        }
      }

      if (ledgerItems.length === 0) {
        // Fallback or in-memory simulation items
        const variantsList = [
          {
            id: 'var-1',
            product_id: 'p-1',
            product_name: 'Royal Emerald Banarasi Katan Silk Saree',
            category_label: 'Banarasi Silk',
            sku: 'VK-SAR-BAN-001-EME',
            variant_name: 'Emerald Green',
            color: 'Emerald Green',
            stock_quantity: 12,
            reserved_quantity: 1,
            price: 18500,
          },
          {
            id: 'var-2',
            product_id: 'p-2',
            product_name: 'Crimson & Temple Zari Kanjivaram Silk Saree',
            category_label: 'Kanjivaram Silk',
            sku: 'VK-SAR-KAN-002-CRM',
            variant_name: 'Crimson Red',
            color: 'Crimson Red',
            stock_quantity: 3,
            reserved_quantity: 0,
            price: 24000,
          },
          {
            id: 'var-3',
            product_id: 'p-4',
            product_name: 'Indigo Bagh Hand-Block Printed Cotton Bedsheet Set',
            category_label: 'Handblock Cotton',
            sku: 'VK-BED-BAG-004-KNG',
            variant_name: 'King Size (108" x 108")',
            stock_quantity: 20,
            reserved_quantity: 2,
            price: 4800,
          },
        ];

        ledgerItems = variantsList.map((v) => {
          const mem = inMemoryStockMap.get(v.id);
          const stock = mem ? mem.stock_quantity : v.stock_quantity;
          const reserved = mem ? mem.reserved_quantity : v.reserved_quantity;
          const available = Math.max(0, stock - reserved);
          const threshold = inMemoryThresholdsMap.get(v.id) || 5;

          let status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
          if (available <= 0) status = 'out_of_stock';
          else if (available < threshold) status = 'low_stock';

          return {
            variantId: v.id,
            productId: v.product_id,
            productName: v.product_name,
            categoryLabel: v.category_label,
            sku: v.sku,
            variantName: v.variant_name,
            color: v.color,
            stockQuantity: stock,
            reservedQuantity: reserved,
            soldQuantity: 3,
            availableQuantity: available,
            lowStockThreshold: threshold,
            status,
            updatedAt: new Date().toISOString(),
            price: v.price,
            imageUrl: '',
          };
        });
      }

      // Compute aggregate metrics
      const uniqueProductIds = new Set(ledgerItems.map((i) => i.productId));
      const summary = {
        totalProducts: uniqueProductIds.size,
        totalVariants: ledgerItems.length,
        inStockCount: ledgerItems.filter((i) => i.status === 'in_stock').length,
        lowStockCount: ledgerItems.filter((i) => i.status === 'low_stock').length,
        outOfStockCount: ledgerItems.filter((i) => i.status === 'out_of_stock').length,
        totalReserved: ledgerItems.reduce((s, i) => s + i.reservedQuantity, 0),
        totalSold: ledgerItems.reduce((s, i) => s + (i.soldQuantity || 0), 0),
        totalPhysical: ledgerItems.reduce((s, i) => s + i.stockQuantity, 0),
      };

      res.json({ success: true, items: ledgerItems, summary });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Error fetching admin inventory.' });
    }
  });

  // POST /api/admin/inventory/adjust (COMMIT LEDGER ADJUSTMENT / STOCK-IN)
  app.post('/api/admin/inventory/adjust', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const isAdmin = await checkAdminRole(req.user?.id);
      if (!isAdmin) {
        res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
        return;
      }

      const { variantId, quantityChange, movementType = 'adjustment', notes } = req.body;

      if (!variantId) {
        res.status(400).json({ success: false, error: 'Variant ID is required.' });
        return;
      }

      const delta = Number(quantityChange);
      if (isNaN(delta) || delta === 0) {
        res.status(400).json({ success: false, error: 'Quantity change must be a non-zero number.' });
        return;
      }

      if (!notes || typeof notes !== 'string' || !notes.trim()) {
        res.status(400).json({ success: false, error: 'Audit reason/notes are required for inventory adjustments.' });
        return;
      }

      const actorEmail = req.user?.email || 'mama@vkvastram.com';
      let newStock = 0;

      if (db) {
        // Fetch current stock
        const { data: v, error: fetchErr } = await db
          .from('product_variants')
          .select('stock_quantity')
          .eq('id', variantId)
          .maybeSingle();

        if (fetchErr || !v) {
          res.status(404).json({ success: false, error: 'Variant not found in database.' });
          return;
        }

        const currentStock = Number(v.stock_quantity) || 0;
        newStock = Math.max(0, currentStock + delta);

        // Update variant physical stock
        const { error: updateErr } = await db
          .from('product_variants')
          .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
          .eq('id', variantId);

        if (updateErr) {
          res.status(500).json({ success: false, error: updateErr.message });
          return;
        }

        // Send queued restock alerts when provider credentials are configured.
        void dispatchReadyBackInStockEmails(variantId);

        // Insert audit movement record
        await db.from('inventory_movements').insert({
          product_variant_id: variantId,
          movement_type: movementType,
          quantity: delta,
          notes: notes.trim(),
          created_by: actorEmail,
          created_at: new Date().toISOString(),
        });
      } else {
        // In-memory update
        let v = inMemoryStockMap.get(variantId);
        if (!v) {
          v = { variant_id: variantId, stock_quantity: 10, reserved_quantity: 0 };
          inMemoryStockMap.set(variantId, v);
        }
        v.stock_quantity = Math.max(0, v.stock_quantity + delta);
        newStock = v.stock_quantity;

        inMemoryMovementsList.unshift({
          id: `mov-${Date.now()}`,
          product_variant_id: variantId,
          movement_type: movementType,
          quantity: delta,
          notes: notes.trim(),
          created_by: actorEmail,
          created_at: new Date().toISOString(),
        });
      }

      res.json({
        success: true,
        newStock,
        message: `Inventory updated successfully. New physical stock count: ${newStock} units.`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Error processing stock adjustment.' });
    }
  });

  // GET /api/admin/inventory/movements (HISTORICAL MOVEMENT AUDIT LEDGER)
  app.get('/api/admin/inventory/movements', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const isAdmin = await checkAdminRole(req.user?.id);
      if (!isAdmin) {
        res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
        return;
      }

      const { variantId } = req.query;

      if (db) {
        let query = db
          .from('inventory_movements')
          .select(`
            *,
            variant:product_variants(id, sku, variant_name, product:products(name))
          `)
          .order('created_at', { ascending: false })
          .limit(100);

        if (variantId && typeof variantId === 'string') {
          query = query.eq('product_variant_id', variantId);
        }

        const { data, error } = await query;
        if (!error && data) {
          const formatted = data.map((m: any) => ({
            id: m.id,
            variantId: m.product_variant_id,
            productName: m.variant?.product?.name || 'Handloom Item',
            sku: m.variant?.sku || 'SKU-VK',
            movementType: m.movement_type,
            quantity: m.quantity,
            referenceType: m.reference_type,
            referenceId: m.reference_id,
            notes: m.notes,
            createdBy: m.created_by || 'System',
            createdAt: m.created_at,
          }));
          res.json({ success: true, movements: formatted });
          return;
        }
      }

      // In-memory fallback
      let filtered = [...inMemoryMovementsList];
      if (variantId && typeof variantId === 'string') {
        filtered = filtered.filter((m) => m.product_variant_id === variantId);
      }

      const formatted = filtered.map((m) => ({
        id: m.id,
        variantId: m.product_variant_id,
        productName: 'Banarasi Silk Saree',
        sku: 'VK-SAR-BAN-001',
        movementType: m.movement_type,
        quantity: m.quantity,
        referenceType: m.reference_type || null,
        referenceId: m.reference_id || null,
        notes: m.notes,
        createdBy: m.created_by || 'System',
        createdAt: m.created_at,
      }));

      res.json({ success: true, movements: formatted });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Error fetching inventory movements.' });
    }
  });

  // POST /api/admin/inventory/threshold (UPDATE LOW-STOCK THRESHOLD)
  app.post('/api/admin/inventory/threshold', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const isAdmin = await checkAdminRole(req.user?.id);
      if (!isAdmin) {
        res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
        return;
      }

      const { variantId, threshold } = req.body;
      const numThreshold = Math.max(1, Number(threshold) || 5);

      inMemoryThresholdsMap.set(variantId, numThreshold);

      if (db) {
        try {
          await db
            .from('product_variants')
            .update({ low_stock_threshold: numThreshold })
            .eq('id', variantId);
        } catch {
          // ignore if column pending schema migration
        }
      }

      res.json({
        success: true,
        threshold: numThreshold,
        message: `Low-stock alert threshold updated to ${numThreshold} units.`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Error updating low-stock threshold.' });
    }
  });
  app.post(
    '/api/admin/media/upload',
    authenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const isAdmin = await checkAdminRole(req.user?.id);
        if (!isAdmin) {
          res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
          return;
        }

        const { fileData, filename, folder = 'uploads', contentType = 'image/jpeg' } = req.body;
        if (!fileData || !filename) {
          res.status(400).json({ success: false, error: 'File data and filename are required.' });
          return;
        }

        const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedMime.includes(contentType.toLowerCase())) {
          res.status(400).json({ success: false, error: 'Invalid file type. Allowed: JPEG, PNG, WebP. SVG uploads are not accepted.' });
          return;
        }

        const base64Clean = fileData.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
        const buffer = Buffer.from(base64Clean, 'base64');

        if (!buffer.length || buffer.length > 8 * 1024 * 1024) {
          res.status(413).json({ success: false, error: 'File too large. Maximum size is 8MB.' });
          return;
        }
        if (!hasImageSignature(buffer, contentType)) {
          res.status(400).json({ success: false, error: 'The uploaded file content does not match a supported image format.' });
          return;
        }

        const ext = contentType.toLowerCase() === 'image/webp' ? 'webp' : contentType.toLowerCase() === 'image/png' ? 'png' : 'jpg';
        const sanitizedFolder = ['logo', 'homepage', 'banners', 'collections', 'categories', 'products', 'pages'].includes(folder)
          ? folder
          : 'uploads';
        const cleanName = filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
        const storagePath = `${sanitizedFolder}/${Date.now()}-${cleanName}.${ext}`;

        if (!supabaseAdmin) {
          res.status(500).json({ success: false, error: 'Supabase storage service unavailable.' });
          return;
        }

        const { error: uploadError } = await supabaseAdmin.storage
          .from('store-assets')
          .upload(storagePath, buffer, {
            contentType,
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) {
          console.error('[admin/media/upload] storage upload failed:', uploadError.name || 'STORAGE_ERROR');
          res.status(500).json({ success: false, error: 'Media upload failed.' });
          return;
        }

        const { data: publicUrlData } = supabaseAdmin.storage
          .from('store-assets')
          .getPublicUrl(storagePath);

        res.json({
          success: true,
          url: publicUrlData.publicUrl,
          path: storagePath,
        });
      } catch (err: any) {
        console.error('[admin/media/upload] request failed');
        res.status(500).json({ success: false, error: 'Media upload failed.' });
      }
    }
  );

  // -------------------------------------------------------------------
  // COUPONS: PUBLIC VALIDATION + ADMIN MANAGEMENT / USAGE HISTORY
  // -------------------------------------------------------------------
  app.post('/api/coupons/validate', optionalAuthenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!db) { res.status(503).json({ success: false, error: 'Coupon service unavailable.' }); return; }
      const code = String(req.body?.code || '').trim().toUpperCase();
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      if (!code || !items.length) { res.status(400).json({ success: false, error: 'Enter a coupon code and add items to your cart.' }); return; }
      const { data: coupon, error } = await db.from('coupons').select('*').eq('code', code).eq('is_active', true).maybeSingle();
      if (error) throw error;
      const now = Date.now();
      if (!coupon || new Date(coupon.starts_at).getTime() > now || (coupon.expires_at && new Date(coupon.expires_at).getTime() < now)) {
        res.status(400).json({ success: false, error: 'This coupon is invalid or outside its validity period.' }); return;
      }
      if (coupon.usage_limit != null) {
        const { count, error: countError } = await db.from('coupon_usage').select('id', { count: 'exact', head: true }).eq('coupon_id', coupon.id);
        if (countError) throw countError;
        if ((count || 0) >= Number(coupon.usage_limit)) { res.status(400).json({ success: false, error: 'This coupon has reached its usage limit.' }); return; }
      }
      if (req.user?.id && coupon.per_user_limit != null) {
        const { count: userCount, error: userCountError } = await db.from('coupon_usage').select('id', { count: 'exact', head: true }).eq('coupon_id', coupon.id).eq('user_id', req.user.id);
        if (userCountError) throw userCountError;
        if ((userCount || 0) >= Number(coupon.per_user_limit)) { res.status(400).json({ success: false, error: 'You have already used this coupon the maximum number of times.' }); return; }
      }
      const variantIds = items.map((i: any) => String(i.variant_id || '')).filter(Boolean);
      if (variantIds.length !== items.length) { res.status(400).json({ success: false, error: 'A cart item is missing its selected variant.' }); return; }
      const { data: variants, error: variantsError } = await db.from('product_variants').select('id, product_id, price_override, stock_quantity, is_active, products!inner(price,status)').in('id', variantIds);
      if (variantsError) throw variantsError;
      const byId = new Map((variants || []).map((v: any) => [v.id, v]));
      let subtotal = 0;
      for (const item of items) {
        const v: any = byId.get(String(item.variant_id));
        const quantity = Number(item.quantity);
        if (!v || !v.is_active || v.products?.status !== 'active' || !Number.isInteger(quantity) || quantity < 1 || Number(v.stock_quantity || 0) < quantity) {
          res.status(400).json({ success: false, error: 'One or more cart items are unavailable.' }); return;
        }
        subtotal += Number(v.price_override ?? v.products.price) * quantity;
      }
      if (subtotal < Number(coupon.minimum_order_value || 0)) { res.status(400).json({ success: false, error: `Minimum cart value for this coupon is ₹${Number(coupon.minimum_order_value || 0).toLocaleString('en-IN')}.` }); return; }
      let discountAmount = coupon.discount_type === 'percentage' ? subtotal * Number(coupon.discount_value) / 100 : Number(coupon.discount_value);
      if (coupon.maximum_discount != null) discountAmount = Math.min(discountAmount, Number(coupon.maximum_discount));
      discountAmount = Math.max(0, Math.min(subtotal, Math.round(discountAmount * 100) / 100));
      res.json({ success: true, discountAmount, message: `Coupon ${code} applied. Final discount is recalculated by the server at order creation.` });
    } catch (err: any) {
      console.error('[coupons/validate] failed:', err);
      res.status(500).json({ success: false, error: 'Unable to validate coupon right now.' });
    }
  });

  app.get('/api/admin/coupons', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!(await checkAdminRole(req.user?.id))) { res.status(403).json({ success: false, error: 'Admin access required.' }); return; }
      if (!db) { res.status(503).json({ success: false, error: 'Database service unavailable.' }); return; }
      const { data, error } = await db.from('coupons').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      res.json({ success: true, coupons: data || [] });
    } catch (err: any) { console.error('[admin/coupons] list failed:', err); res.status(500).json({ success: false, error: 'Unable to load coupons.' }); }
  });

  app.post('/api/admin/coupons', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!(await checkAdminRole(req.user?.id))) { res.status(403).json({ success: false, error: 'Admin access required.' }); return; }
      if (!db) { res.status(503).json({ success: false, error: 'Database service unavailable.' }); return; }
      const b = req.body || {};
      const code = String(b.code || '').trim().toUpperCase();
      const type = b.discount_type;
      const value = Number(b.discount_value);
      const minimum = Number(b.minimum_order_value || 0);
      if (!/^[A-Z0-9_-]{3,40}$/.test(code) || !['percentage', 'fixed_amount'].includes(type) || !Number.isFinite(value) || value <= 0 || (type === 'percentage' && value > 100) || !Number.isFinite(minimum) || minimum < 0) {
        res.status(400).json({ success: false, error: 'Check coupon code, discount type/value, and minimum cart value.' }); return;
      }
      const startsAt = new Date(b.starts_at || Date.now());
      const expiresAt = b.expires_at ? new Date(b.expires_at) : null;
      if (!Number.isFinite(startsAt.getTime()) || (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt <= startsAt))) { res.status(400).json({ success: false, error: 'Coupon validity dates are invalid.' }); return; }
      const payload = { code, description: String(b.description || '').trim() || null, discount_type: type, discount_value: value, minimum_order_value: minimum, maximum_discount: b.maximum_discount == null || b.maximum_discount === '' ? null : Number(b.maximum_discount), usage_limit: b.usage_limit == null || b.usage_limit === '' ? null : Number(b.usage_limit), per_user_limit: null, starts_at: startsAt.toISOString(), expires_at: expiresAt?.toISOString() || null, is_active: b.is_active !== false };
      const { data, error } = await db.from('coupons').insert(payload).select('*').single();
      if (error) { if (error.code === '23505') { res.status(409).json({ success: false, error: 'That coupon code already exists.' }); return; } throw error; }
      res.status(201).json({ success: true, coupon: data });
    } catch (err: any) { console.error('[admin/coupons] create failed:', err); res.status(500).json({ success: false, error: 'Unable to create coupon.' }); }
  });

  app.patch('/api/admin/coupons/:id', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!(await checkAdminRole(req.user?.id))) { res.status(403).json({ success: false, error: 'Admin access required.' }); return; }
      if (!db) { res.status(503).json({ success: false, error: 'Database service unavailable.' }); return; }
      if (typeof req.body?.is_active !== 'boolean') { res.status(400).json({ success: false, error: 'is_active must be a boolean.' }); return; }
      const { data, error } = await db.from('coupons').update({ is_active: req.body.is_active, updated_at: new Date().toISOString() }).eq('id', req.params.id).select('id').maybeSingle();
      if (error) throw error;
      if (!data) { res.status(404).json({ success: false, error: 'Coupon not found.' }); return; }
      res.json({ success: true });
    } catch (err: any) { console.error('[admin/coupons] toggle failed:', err); res.status(500).json({ success: false, error: 'Unable to update coupon.' }); }
  });

  app.get('/api/admin/coupons/usage', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!(await checkAdminRole(req.user?.id))) { res.status(403).json({ success: false, error: 'Admin access required.' }); return; }
      if (!db) { res.status(503).json({ success: false, error: 'Database service unavailable.' }); return; }
      const { data, error } = await db.from('coupon_usage').select('id, coupon_id, user_id, order_id, used_at, coupons(code, discount_type, discount_value), orders(order_number, customer_email, discount_amount, total_amount)').order('used_at', { ascending: false }).limit(500);
      if (error) throw error;
      res.json({ success: true, usage: data || [] });
    } catch (err: any) { console.error('[admin/coupons/usage] failed:', err); res.status(500).json({ success: false, error: 'Unable to load coupon usage history.' }); }
  });

  // -------------------------------------------------------------------
  // POST /api/admin/settings (ADMIN SITE SETTINGS PERSISTENCE)
  // -------------------------------------------------------------------
  app.post(
    '/api/admin/settings',
    authenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const isAdmin = await checkAdminRole(req.user?.id);
        if (!isAdmin) {
          res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
          return;
        }

        const { general, policies } = req.body;
        if (!db) {
          res.status(500).json({ success: false, error: 'Database service unavailable.' });
          return;
        }

        if (general) {
          const { error: genErr } = await db.from('site_settings').upsert({
            key: 'general',
            value: general,
            updated_at: new Date().toISOString(),
          });
          if (genErr) {
            res.status(500).json({ success: false, error: genErr.message });
            return;
          }
        }

        if (policies) {
          const { error: polErr } = await db.from('site_settings').upsert({
            key: 'policies',
            value: policies,
            updated_at: new Date().toISOString(),
          });
          if (polErr) {
            res.status(500).json({ success: false, error: polErr.message });
            return;
          }
        }

        res.json({ success: true, message: 'Settings saved successfully.' });
      } catch (err: any) {
        res.status(500).json({ success: false, error: err.message || 'Failed to save settings.' });
      }
    }
  );

  // -------------------------------------------------------------------
  // POST /api/admin/products/create (AUTHORITATIVE PRODUCT CREATION)
  // -------------------------------------------------------------------
  app.post(
    '/api/admin/products/create',
    authenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const isAdmin = await checkAdminRole(req.user?.id);
        if (!isAdmin) {
          res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
          return;
        }

        if (!db) {
          res.status(500).json({ success: false, error: 'Database service unavailable.' });
          return;
        }

        const { product, images, variants } = req.body;
        if (!product || !product.name || !product.slug) {
          res.status(400).json({ success: false, error: 'Product name and slug are required.' });
          return;
        }

        const initialStatus = product.status || 'draft';
        const initialPrice = Number(product.price);
        const initialGstRate = product.gstRate === undefined || product.gstRate === null || product.gstRate === '' ? null : Number(product.gstRate);
        if (initialStatus === 'active' && (!Number.isFinite(initialPrice) || initialPrice <= 0)) {
          res.status(400).json({ success: false, error: 'An active product must have a selling price greater than zero. Keep dummy products in Draft.' });
          return;
        }
        if (initialStatus === 'active' && (initialGstRate === null || !Number.isFinite(initialGstRate) || initialGstRate < 0 || initialGstRate > 100)) {
          res.status(400).json({ success: false, error: 'Choose a valid GST rate before activating this product.' });
          return;
        }

        // Validate unique slug
        let finalSlug = product.slug.trim().toLowerCase();
        const { data: existingSlug } = await db.from('products').select('id').eq('slug', finalSlug).maybeSingle();
        if (existingSlug) {
          finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
        }

        const baseSku = product.sku ? product.sku.trim() : `VKV-${Date.now().toString().slice(-6)}`;
        const categoryId = product.categoryId && product.categoryId.trim() ? product.categoryId.trim() : null;
        const collectionId = product.collectionId && product.collectionId.trim() ? product.collectionId.trim() : null;

        const { data: newProd, error: insertError } = await db
          .from('products')
          .insert({
            name: product.name.trim(),
            slug: finalSlug,
            sku: baseSku,
            category_id: categoryId,
            collection_id: collectionId,
            price: Number(product.price) || 0,
            gst_rate: initialGstRate,
            mrp: product.mrp ? Number(product.mrp) : null,
            status: product.status || 'draft',
            featured: Boolean(product.featured),
            bestseller: Boolean(product.bestSeller),
            new_arrival: Boolean(product.newArrival),
            description: product.description || null,
            metadata: product.metadata || {},
            fabric: product.fabric || null,
            weave: product.weave || null,
            origin: product.origin || null,
            dimensions: product.dimensions || null,
            care_instructions: product.care || product.care_instructions || null,
            seo_title: product.seoTitle || null,
            seo_description: product.seoDescription || null,
            updated_at: new Date().toISOString(),
          })
          .select('id, name, slug, sku')
          .single();

        if (insertError || !newProd) {
          res.status(500).json({ success: false, error: insertError?.message || 'Failed to create product record.' });
          return;
        }

        const productId = newProd.id;
        if (!Array.isArray(variants) || variants.length === 0) {
          await db.from('products').delete().eq('id', productId);
          res.status(400).json({ success: false, error: 'At least one stock variant is required before a product can be saved.' });
          return;
        }

        // 1. Insert variants first with standardized SKU format to obtain stable variant IDs
        const variantSkuToIdMap = new Map<string, string>();
        if (Array.isArray(variants) && variants.length > 0) {
          for (let idx = 0; idx < variants.length; idx++) {
            const v = variants[idx];
            const vIndex = String(idx + 1).padStart(2, '0');
            // Respect the form's SKU (e.g. VKV-SAR-001-01); otherwise use a stable
            // numeric suffix. Do not silently rewrite SKUs to the legacy "-V01" format.
            const vSku = typeof v.sku === 'string' && v.sku.trim()
              ? v.sku.trim()
              : `${baseSku}-${vIndex}`;
            const { data: insertedVar, error: variantInsertError } = await db
              .from('product_variants')
              .insert({
                product_id: productId,
                sku: vSku,
                variant_name: v.variantName || 'Standard',
                color: v.color || null,
                size: v.size || null,
                bed_size: v.bedSize || null,
                dimensions: v.dimensions || null,
                price_override: v.priceOverride ? Number(v.priceOverride) : null,
                mrp_override: v.mrpOverride ? Number(v.mrpOverride) : null,
                stock_quantity: Number(v.stockQuantity || 0),
                is_active: true,
                attributes: v.attributes || null,
              })
              .select('id')
              .single();

            if (variantInsertError || !insertedVar?.id) {
              // Product creation must not silently succeed without its stock ledger.
              const cleanup = await db.from('products').delete().eq('id', productId);
              if (cleanup.error) console.error('[admin/products/create] failed to roll back product after variant insert failure:', cleanup.error.message);
              res.status(500).json({ success: false, error: `Variant could not be saved: ${variantInsertError?.message || 'database returned no variant ID'}. Product creation was rolled back where possible.` });
              return;
            }
            if (insertedVar?.id) {
              variantSkuToIdMap.set(vSku, insertedVar.id);
              if (v.id) variantSkuToIdMap.set(v.id, insertedVar.id);
            }
          }
        }

        // 2. Insert images with variant association, semantic role, and presentation adjustment
        if (Array.isArray(images) && images.length > 0) {
          const imageRows = images.map((img: any, idx: number) => {
            const matchedVarId = img.variantId || (img.variantSku ? variantSkuToIdMap.get(img.variantSku) : null) || null;
            return {
              product_id: productId,
              variant_id: matchedVarId,
              image_url: img.imageUrl,
              alt_text: img.altText || product.name,
              is_primary: Boolean(img.isPrimary),
              sort_order: img.sortOrder || idx + 1,
              role: img.role || (idx === 0 ? 'hero' : 'gallery'),
              fit: img.fit || 'cover',
              focal_x: img.focalPositionX ?? img.focalX ?? img.focal_x ?? 50,
              focal_y: img.focalPositionY ?? img.focalY ?? img.focal_y ?? 50,
              scale: img.scale ? Number(img.scale) : 1.0,
            };
          });
          const { error: imageInsertError } = await db.from('product_images').insert(imageRows);
          if (imageInsertError) {
            console.error('[admin/products/create] product image insert failed', { productId, message: imageInsertError.message });
            res.status(500).json({ success: false, error: `Product was created, but its images could not be saved: ${imageInsertError.message}. Reopen the product and save again after resolving this database error.` });
            return;
          }
        }

        res.json({ success: true, productId, product: newProd });
      } catch (err: any) {
        res.status(500).json({ success: false, error: err?.message || 'Error creating product.' });
      }
    }
  );

  // NOTE: this static route MUST be registered before '/api/admin/products/:id'. Express matches in
  // declaration order, so otherwise 'import' is treated as a product id and the import never runs
  // ("Product ID and payload are required").
  // -------------------------------------------------------------------
  // POST /api/admin/products/import (BULK EXCEL PRODUCT IMPORT)
  // -------------------------------------------------------------------
  app.post(
    '/api/admin/products/import',
    authenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const isAdmin = await checkAdminRole(req.user?.id);
        if (!isAdmin) {
          res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
          return;
        }

        const { products } = req.body;
        if (!Array.isArray(products) || products.length === 0) {
          res.status(400).json({ success: false, error: 'A non-empty products array is required.' });
          return;
        }

        if (!db) {
          res.status(500).json({ success: false, error: 'Database service unavailable.' });
          return;
        }

        // Cache categories and collections for fast taxonomy lookup
        const { data: categories } = await db.from('categories').select('id, name, slug');
        const { data: collections } = await db.from('collections').select('id, name, slug');
        const { data: taxonomySettings, error: taxonomyError } = await db.from('site_settings').select('key, value').in('key', ['saree_types', 'fabric_types']);
        if (taxonomyError) throw new Error(`Could not validate managed Saree Types and Fabrics: ${taxonomyError.message}`);
        const managedNames = (key: string): Set<string> => {
          const setting = (taxonomySettings || []).find((row: any) => row.key === key)?.value;
          const parsed = typeof setting === 'string' ? (() => { try { return JSON.parse(setting); } catch { return null; } })() : setting;
          return new Set<string>((Array.isArray(parsed?.types) ? parsed.types : []).filter((x: any) => x && x.active !== false && x.name).map((x: any) => String(x.name).trim().toLowerCase()));
        };
        const managedSareeTypes = managedNames('saree_types');
        const managedFabrics = managedNames('fabric_types');

        const catMap = new Map<string, string>();
        categories?.forEach((c: any) => {
          catMap.set(c.slug.toLowerCase(), c.id);
          catMap.set(c.name.toLowerCase(), c.id);
        });

        const colMap = new Map<string, string>();
        collections?.forEach((c: any) => {
          colMap.set(c.slug.toLowerCase(), c.id);
          colMap.set(c.name.toLowerCase(), c.id);
        });

        const defaultCategoryId = catMap.get('sarees') || categories?.[0]?.id || null;

        let importedCount = 0;
        let updatedCount = 0;
        let failedCount = 0;
        const errors: { row: number; sku?: string; error: string }[] = [];

        for (let idx = 0; idx < products.length; idx++) {
          const item = products[idx];
          const rowNumber = idx + 2; // matching excel row index (1-based + 1 for header)

          try {
            if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
              throw new Error('Product name is required.');
            }

            // ---- Lenient import policy -------------------------------------------------
            // Only the product name is mandatory. Every other column is optional: valid values are
            // saved, missing/invalid ones are left empty, and an incomplete NEW product (no price,
            // no image or no recognised category) is saved as a draft instead of going live.
            const text = (value: any) => String(value ?? '').trim();
            const rawPrice = Number(item.price);
            const price = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 0;
            const hasPrice = price > 0;
            const hexOf = (value: any) => (/^#[0-9a-f]{6}$/i.test(text(value)) ? text(value).toUpperCase() : '');
            const primaryHex = hexOf(item.primaryColourHex);
            const secondaryHex = hexOf(item.secondaryColourHex);
            const secondaryName = secondaryHex ? text(item.secondaryColourName) : '';
            // Variant colour name follows the product form: "Primary" or "Primary / Secondary".
            const variantColor = [text(item.color), secondaryName].filter(Boolean).join(' / ');

            let mrp: number | null = item.mrp ? Number(item.mrp) : null;
            if (mrp !== null && (!Number.isFinite(mrp) || mrp <= 0 || mrp < price)) mrp = null;

            const isUsableImageUrl = (value: any) => {
              const url = text(value);
              return /^https?:\/\//i.test(url) && !/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?)(:|\/|$)/i.test(url);
            };
            const primaryImage = isUsableImageUrl(item.primaryImageUrl) ? text(item.primaryImageUrl) : '';

            const cleanSku = (item.sku || `VKV-SAR-${Date.now().toString().slice(-6)}-${idx + 1}`).trim().toUpperCase();
            const cleanSlug = (item.slug || item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')).trim() || `product-${Date.now().toString().slice(-6)}-${idx + 1}`;

            // Category: blank/unknown falls back to the default category and forces a draft.
            const catKey = text(item.category).toLowerCase();
            const categoryKnown = Boolean(catKey) && catMap.has(catKey);
            const categoryId = categoryKnown ? catMap.get(catKey)! : defaultCategoryId;
            if (!categoryId) throw new Error('No product categories exist yet. Create a category first, then import.');

            // Collection: unknown names are ignored instead of failing the row.
            let collectionId: string | null = null;
            const colKey = text(item.collection).toLowerCase();
            if (colKey && colMap.has(colKey)) collectionId = colMap.get(colKey)!;

            // Stock: blank/invalid means "not provided" (0 for a new product, unchanged for an existing one).
            const rawStock = item.stockQuantity ?? item.stock;
            const stockNumber = rawStock !== undefined && rawStock !== null && text(rawStock) !== '' ? Number(rawStock) : NaN;
            const stockProvided = Number.isInteger(stockNumber) && stockNumber >= 0;
            const stockQuantity = stockProvided ? stockNumber : 0;

            // Status the sheet asked for ('' when the column was blank).
            const requestedStatus: '' | 'active' | 'draft' =
              item.requestedStatus === 'draft' || item.requestedStatus === 'active' ? item.requestedStatus : '';
            const newProductStatus: 'active' | 'draft' =
              requestedStatus === 'draft' || !hasPrice || !primaryImage || !categoryKnown ? 'draft' : 'active';

            // Check if product with this SKU already exists
            const { data: existingProduct } = await db
              .from('products')
              .select('id, slug, sku, metadata, price')
              .eq('sku', cleanSku)
              .maybeSingle();

            if (existingProduct) {
              // UPDATE EXISTING
              // UPDATE only what the sheet actually provides: blank cells never wipe existing data,
              // and the live URL slug is preserved.
              const updates: Record<string, any> = { name: item.name.trim(), updated_at: new Date().toISOString() };
              if (hasPrice) updates.price = price;
              if (item.gstRate !== undefined && item.gstRate !== null && item.gstRate !== '' && Number.isFinite(Number(item.gstRate))) updates.gst_rate = Number(item.gstRate);
              if (mrp) updates.mrp = mrp;
              if (categoryKnown) updates.category_id = categoryId;
              if (collectionId) updates.collection_id = collectionId;
              if (text(item.fabric)) updates.fabric = text(item.fabric);
              if (text(item.weave)) updates.weave = text(item.weave);
              if (text(item.origin)) updates.origin = text(item.origin);
              if (text(item.dimensions)) updates.dimensions = text(item.dimensions);
              if (text(item.careInstructions || item.care)) updates.care_instructions = text(item.careInstructions || item.care);
              if (text(item.description)) updates.description = text(item.description);
              if (text(item.seoTitle)) updates.seo_title = text(item.seoTitle);
              if (text(item.seoDescription)) updates.seo_description = text(item.seoDescription);
              if (item.featured === true) updates.featured = true;
              if (item.bestSeller === true) updates.bestseller = true;
              if (item.newArrival === true) updates.new_arrival = true;
              if (requestedStatus === 'draft') updates.status = 'draft';
              else if (requestedStatus === 'active' && (hasPrice || Number(existingProduct.price) > 0)) updates.status = 'active';
              updates.metadata = {
                ...(existingProduct.metadata && typeof existingProduct.metadata === 'object' ? existingProduct.metadata : {}),
                ...(text(item.sareeType) ? { sareeType: text(item.sareeType) } : {}),
                ...(text(item.color) ? { primaryColourName: text(item.color) } : {}),
                ...(primaryHex ? { primaryColourHex: primaryHex } : {}),
                ...(secondaryName ? { secondaryColourName: secondaryName } : {}),
                ...(secondaryHex ? { secondaryColourHex: secondaryHex } : {}),
                ...(Array.isArray(item.tags) && item.tags.length ? { tags: item.tags } : {}),
              };
              const { error: updateError } = await db
                .from('products')
                .update(updates)
                .eq('id', existingProduct.id);

              if (updateError) throw updateError;

              // Upsert/Update primary image if provided
              if (primaryImage) {
                const { data: existingImg } = await db
                  .from('product_images')
                  .select('id')
                  .eq('product_id', existingProduct.id)
                  .eq('is_primary', true)
                  .maybeSingle();

                if (existingImg) {
                  await db
                    .from('product_images')
                    .update({ image_url: primaryImage, alt_text: item.imageAltText || item.name.trim() })
                    .eq('id', existingImg.id);
                } else {
                  await db.from('product_images').insert({
                    product_id: existingProduct.id,
                    image_url: primaryImage,
                    alt_text: item.name.trim(),
                    is_primary: true,
                    sort_order: 1,
                  });
                }
              }

              if (Array.isArray(item.additionalImageUrls)) {
                for (let imageIndex = 0; imageIndex < item.additionalImageUrls.length; imageIndex++) {
                  const imageUrl = String(item.additionalImageUrls[imageIndex] || '').trim();
                  if (!isUsableImageUrl(imageUrl)) continue;
                  const { data: alreadyThere } = await db.from('product_images').select('id').eq('product_id', existingProduct.id).eq('image_url', imageUrl).maybeSingle();
                  if (!alreadyThere) await db.from('product_images').insert({ product_id: existingProduct.id, image_url: imageUrl, alt_text: item.imageAltText || item.name.trim(), is_primary: false, sort_order: imageIndex + 2 });
                }
              }

              // Match only a variant belonging to this product. Importing metadata
              // must not reset stock on an existing variant; use Inventory Control Center
              // for explicit stock movements.
              const { data: exactVariant, error: variantLookupError } = await db
                .from('product_variants')
                .select('id, product_id, stock_quantity, reserved_quantity, sku')
                .eq('product_id', existingProduct.id)
                .eq('sku', cleanSku)
                .maybeSingle();
              if (variantLookupError) throw variantLookupError;
              let existingVariant = exactVariant;
              if (!existingVariant) {
                const { data: productVariants, error: variantsLookupError } = await db.from('product_variants')
                  .select('id, product_id, stock_quantity, reserved_quantity, sku').eq('product_id', existingProduct.id).eq('is_active', true).limit(2);
                if (variantsLookupError) throw variantsLookupError;
                if ((productVariants || []).length === 1) existingVariant = productVariants![0];
                else if ((productVariants || []).length > 1) throw new Error('This product has multiple active variants. A single product row cannot safely distribute Stock Quantity across them; update stock in Inventory or use variant-level inventory rows.');
              }

              if (existingVariant) {
                const currentStock = Number(existingVariant.stock_quantity || 0);
                const reservedStock = Number(existingVariant.reserved_quantity || 0);
                if (stockProvided && (!Number.isSafeInteger(stockQuantity) || stockQuantity < reservedStock)) {
                  throw new Error(`Imported stock for ${cleanSku} cannot be below the ${reservedStock} unit(s) reserved by orders.`);
                }
                if (stockProvided && stockQuantity !== currentStock) {
                  // Import stock as an audited inventory adjustment. Optimistic stock
                  // matching prevents overwriting a concurrent checkout's inventory update.
                  const { data: stockUpdate, error: stockUpdateError } = await db.from('product_variants')
                    .update({ stock_quantity: stockQuantity, ...(variantColor ? { color: variantColor } : {}), updated_at: new Date().toISOString() })
                    .eq('id', existingVariant.id).eq('stock_quantity', currentStock).select('id').maybeSingle();
                  if (stockUpdateError) throw stockUpdateError;
                  if (!stockUpdate) throw new Error(`Stock for ${cleanSku} changed during import. Refresh the catalogue and retry this row.`);
                  const delta = stockQuantity - currentStock;
                  const { error: movementError } = await db.from('inventory_movements').insert({
                    product_variant_id: existingVariant.id, movement_type: 'adjustment', quantity: delta,
                    notes: `Stock synchronized by product Excel import (${cleanSku})`,
                    created_by: req.user?.id || null, created_at: new Date().toISOString(),
                  });
                  if (movementError) {
                    await db.from('product_variants').update({ stock_quantity: currentStock }).eq('id', existingVariant.id).eq('stock_quantity', stockQuantity);
                    throw new Error(`Stock was not imported because the inventory audit entry failed: ${movementError.message}`);
                  }
                } else if (variantColor) {
                  const { error: variantUpdateError } = await db.from('product_variants')
                    .update({ color: variantColor, updated_at: new Date().toISOString() }).eq('id', existingVariant.id);
                  if (variantUpdateError) throw variantUpdateError;
                }
              } else {
                const { error: variantInsertError } = await db.from('product_variants').insert({
                  product_id: existingProduct.id,
                  sku: cleanSku,
                  variant_name: 'Standard Free Size',
                  stock_quantity: stockQuantity,
                  color: variantColor || null,
                  is_active: true,
                });
                if (variantInsertError) throw variantInsertError;
              }

              updatedCount++;
            } else {
              // INSERT NEW PRODUCT
              let finalSlug = cleanSlug;
              const { data: slugCheck } = await db
                .from('products')
                .select('id')
                .eq('slug', finalSlug)
                .maybeSingle();

              if (slugCheck) {
                finalSlug = `${cleanSlug}-${Date.now().toString().slice(-4)}`;
              }

              const { data: newProd, error: insertError } = await db
                .from('products')
                .insert({
                  sku: cleanSku,
                  name: item.name.trim(),
                  slug: finalSlug,
                  price,
                  gst_rate: item.gstRate === undefined || item.gstRate === null || item.gstRate === '' || !Number.isFinite(Number(item.gstRate)) ? null : Number(item.gstRate),
                  mrp,
                  category_id: categoryId,
                  collection_id: collectionId,
                  status: newProductStatus,
                  fabric: text(item.fabric) || null,
                  weave: text(item.weave) || null,
                  origin: text(item.origin) || null,
                  dimensions: text(item.dimensions) || null,
                  care_instructions: text(item.careInstructions || item.care) || null,
                  description: text(item.description) || null,
                  featured: Boolean(item.featured),
                  bestseller: Boolean(item.bestSeller),
                  new_arrival: Boolean(item.newArrival),
                  seo_title: text(item.seoTitle) || null,
                  seo_description: text(item.seoDescription) || null,
                  metadata: {
                    ...(text(item.sareeType) ? { sareeType: text(item.sareeType) } : {}),
                    ...(text(item.color) ? { primaryColourName: text(item.color) } : {}),
                    ...(primaryHex ? { primaryColourHex: primaryHex } : {}),
                    ...(secondaryName ? { secondaryColourName: secondaryName } : {}),
                    ...(secondaryHex ? { secondaryColourHex: secondaryHex } : {}),
                    ...(Array.isArray(item.tags) && item.tags.length ? { tags: item.tags } : {}),
                  },
                })
                .select('id')
                .single();

              if (insertError || !newProd) throw (insertError || new Error('Failed to insert product record'));

              // Primary image
              if (primaryImage) {
                const { error: imageInsertError } = await db.from('product_images').insert({
                  product_id: newProd.id,
                  image_url: primaryImage,
                  alt_text: item.name.trim(),
                  is_primary: true,
                  sort_order: 1,
                });
                if (imageInsertError) throw imageInsertError;
              }

              if (Array.isArray(item.additionalImageUrls)) {
                for (let imageIndex = 0; imageIndex < item.additionalImageUrls.length; imageIndex++) {
                  const imageUrl = String(item.additionalImageUrls[imageIndex] || '').trim();
                  if (!isUsableImageUrl(imageUrl)) continue;
                  await db.from('product_images').insert({ product_id: newProd.id, image_url: imageUrl, alt_text: item.imageAltText || item.name.trim(), is_primary: false, sort_order: imageIndex + 2 });
                }
              }

              // Variant
              const { error: variantInsertError } = await db.from('product_variants').insert({
                product_id: newProd.id,
                sku: cleanSku,
                variant_name: 'Standard Free Size',
                stock_quantity: stockQuantity,
                color: variantColor || null,
                is_active: true,
              });
              if (variantInsertError) throw variantInsertError;

              importedCount++;
            }
          } catch (rowErr: any) {
            failedCount++;
            errors.push({
              row: rowNumber,
              sku: item.sku,
              error: rowErr?.message || 'Unknown row processing error',
            });
          }
        }

        res.json({
          success: true,
          total: products.length,
          imported: importedCount,
          updated: updatedCount,
          failed: failedCount,
          errors,
        });
      } catch (err: any) {
        res.status(500).json({ success: false, error: err.message || 'Import processing failed.' });
      }
    }
  );

  // -------------------------------------------------------------------
  // POST /api/admin/products/:id (AUTHORITATIVE PRODUCT UPDATE & PRESERVATION)
  // -------------------------------------------------------------------
  app.post(
    '/api/admin/products/:id',
    authenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const isAdmin = await checkAdminRole(req.user?.id);
        if (!isAdmin) {
          res.status(403).json({ success: false, error: 'Forbidden. Admin access required.' });
          return;
        }

        if (!db) {
          res.status(500).json({ success: false, error: 'Database service unavailable.' });
          return;
        }

        const { id } = req.params;
        const { product, images, variants } = req.body;

        if (!id || !product) {
          res.status(400).json({ success: false, error: 'Product ID and payload are required.' });
          return;
        }

        // 1. Fetch current existing product
        const { data: currentProduct, error: fetchErr } = await db
          .from('products')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (fetchErr || !currentProduct) {
          res.status(404).json({ success: false, error: 'Product not found in database.' });
          return;
        }

        const categoryId = product.categoryId && product.categoryId.trim() ? product.categoryId.trim() : null;
        const collectionId = product.collectionId && product.collectionId.trim() ? product.collectionId.trim() : null;
        const preservedSku = product.sku ? product.sku.trim() : currentProduct.sku;
        const nextStatus = product.status || currentProduct.status;
        const nextPrice = product.price !== undefined ? Number(product.price) : Number(currentProduct.price);
        const nextGstRate = product.gstRate === undefined
          ? (currentProduct.gst_rate === null || currentProduct.gst_rate === undefined ? null : Number(currentProduct.gst_rate))
          : (product.gstRate === null || product.gstRate === '' ? null : Number(product.gstRate));
        if (nextStatus === 'active' && (!Number.isFinite(nextPrice) || nextPrice <= 0)) {
          res.status(400).json({ success: false, error: 'An active product must have a selling price greater than zero. Keep dummy products in Draft.' });
          return;
        }
        if (nextStatus === 'active' && (nextGstRate === null || !Number.isFinite(nextGstRate) || nextGstRate < 0 || nextGstRate > 100)) {
          res.status(400).json({ success: false, error: 'Choose a valid GST rate before activating this product.' });
          return;
        }

        // 2. Perform authoritative product record update
        const { data: updatedProd, error: updateError } = await db
          .from('products')
          .update({
            name: product.name ? product.name.trim() : currentProduct.name,
            slug: product.slug ? product.slug.trim().toLowerCase() : currentProduct.slug,
            sku: preservedSku,
            category_id: categoryId,
            collection_id: collectionId,
            price: product.price !== undefined ? Number(product.price) : currentProduct.price,
            gst_rate: nextGstRate,
            mrp: product.mrp !== undefined ? (product.mrp ? Number(product.mrp) : null) : currentProduct.mrp,
            status: product.status || currentProduct.status,
            featured: product.featured !== undefined ? Boolean(product.featured) : currentProduct.featured,
            bestseller: product.bestSeller !== undefined ? Boolean(product.bestSeller) : currentProduct.bestseller,
            new_arrival: product.newArrival !== undefined ? Boolean(product.newArrival) : currentProduct.new_arrival,
            description: product.description !== undefined ? product.description : currentProduct.description,
            metadata: product.metadata !== undefined ? product.metadata : (currentProduct.metadata || {}),
            fabric: product.fabric !== undefined ? product.fabric : currentProduct.fabric,
            weave: product.weave !== undefined ? product.weave : currentProduct.weave,
            origin: product.origin !== undefined ? product.origin : currentProduct.origin,
            dimensions: product.dimensions !== undefined ? product.dimensions : currentProduct.dimensions,
            care_instructions: product.care !== undefined ? product.care : currentProduct.care_instructions,
            seo_title: product.seoTitle !== undefined ? product.seoTitle : currentProduct.seo_title,
            seo_description: product.seoDescription !== undefined ? product.seoDescription : currentProduct.seo_description,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('id, name, slug, sku, price, mrp, status')
          .single();

        if (updateError) {
          res.status(500).json({ success: false, error: updateError.message });
          return;
        }

        // 3. Safe Non-Destructive Variant Synchronization first to ensure all variant IDs are known
        const variantSkuToIdMap = new Map<string, string>();
        if (Array.isArray(variants) && variants.length > 0) {
          const { data: existingVariants, error: existingVariantsError } = await db
            .from('product_variants')
            .select('*')
            .eq('product_id', id);
          if (existingVariantsError) {
            console.error('[admin/products/update] could not read current variants', existingVariantsError);
            res.status(503).json({ success: false, error: `Variant storage is unavailable: ${existingVariantsError.message}` });
            return;
          }

          const existingMap = new Map((existingVariants || []).map((v: any) => [v.id, v]));
          const existingSkuMap = new Map((existingVariants || []).map((v: any) => [v.sku, v]));

          for (let i = 0; i < variants.length; i++) {
            const v = variants[i];
            const vIndex = String(i + 1).padStart(2, '0');
            const submittedSku = typeof v.sku === 'string' ? v.sku.trim() : '';
            const matchedById = v.id ? existingMap.get(v.id) : undefined;
            const matchedBySku = submittedSku ? existingSkuMap.get(submittedSku) : undefined;
            const matchedExisting = matchedById || matchedBySku;

            // Existing variant SKUs are stable identifiers: never rewrite them during
            // an ordinary product edit. New variants may use the form-provided SKU.
            const expectedSku = matchedExisting
              ? matchedExisting.sku
              : (submittedSku || `${preservedSku}-${vIndex}`);

            if (matchedExisting) {
              // The product editor owns the physical stock field. Validate the submitted
              // value and never allow physical stock to fall below already-reserved units.
              const submittedStock =
                v.stockQuantity === undefined || v.stockQuantity === null || v.stockQuantity === ''
                  ? Number(matchedExisting.stock_quantity || 0)
                  : Number(v.stockQuantity);
              const reservedStock = Number(matchedExisting.reserved_quantity || 0);
              if (!Number.isSafeInteger(submittedStock) || submittedStock < 0) {
                throw new Error(`Stock for variant ${expectedSku} must be a whole number of zero or more.`);
              }
              if (!Number.isSafeInteger(reservedStock) || reservedStock < 0) {
                throw new Error(`Could not verify reserved stock for variant ${expectedSku}. No changes were made.`);
              }
              if (submittedStock < reservedStock) {
                throw new Error(`Stock for ${expectedSku} cannot be lower than ${reservedStock} unit(s) already reserved.`);
              }

              const existingAttributes = matchedExisting.attributes && typeof matchedExisting.attributes === 'object' ? matchedExisting.attributes : {};
              const incomingAttributes = v.attributes && typeof v.attributes === 'object' ? v.attributes : {};
              const mergedAttributes = {
                ...existingAttributes,
                ...incomingAttributes,
                colorHexPrimary: v.colorHexPrimary ?? incomingAttributes.colorHexPrimary ?? existingAttributes.colorHexPrimary,
                colorHexSecondary: v.colorHexSecondary ?? incomingAttributes.colorHexSecondary ?? existingAttributes.colorHexSecondary,
                colorSwatchUrl: v.colorSwatchUrl ?? incomingAttributes.colorSwatchUrl ?? existingAttributes.colorSwatchUrl,
                images: Array.isArray(incomingAttributes.images) && incomingAttributes.images.length > 0
                  ? incomingAttributes.images
                  : (existingAttributes as any).images,
              };
              const { error: variantUpdateError } = await db
                .from('product_variants')
                .update({
                  variant_name: v.variantName !== undefined && String(v.variantName).trim() !== ''
                    ? String(v.variantName).trim()
                    : (matchedExisting.variant_name || 'Standard'),
                  color: v.color !== undefined ? (v.color || null) : matchedExisting.color,
                  size: v.size !== undefined ? (v.size || null) : matchedExisting.size,
                  bed_size: v.bedSize !== undefined ? (v.bedSize || null) : matchedExisting.bed_size,
                  dimensions: v.dimensions !== undefined ? (v.dimensions || null) : matchedExisting.dimensions,
                  price_override: v.priceOverride !== undefined
                    ? (v.priceOverride ? Number(v.priceOverride) : null)
                    : matchedExisting.price_override,
                  stock_quantity: submittedStock,
                  is_active: v.isActive !== false,
                  attributes: mergedAttributes,
                })
                .eq('id', matchedExisting.id);

              if (variantUpdateError) throw variantUpdateError;
              variantSkuToIdMap.set(expectedSku, matchedExisting.id);
              void dispatchReadyBackInStockEmails(matchedExisting.id);
              if (v.id) variantSkuToIdMap.set(v.id, matchedExisting.id);
            } else {
              const newStock = Number(v.stockQuantity ?? 0);
              if (!Number.isInteger(newStock) || newStock < 0) {
                throw new Error(`Invalid stock quantity for new variant ${expectedSku}.`);
              }
              const { data: insertedNewVar, error: variantInsertError } = await db
                .from('product_variants')
                .insert({
                  product_id: id,
                  sku: expectedSku,
                  variant_name: v.variantName || 'Standard',
                  color: v.color || null,
                  size: v.size || null,
                  bed_size: v.bedSize || null,
                  dimensions: v.dimensions || null,
                  price_override: v.priceOverride ? Number(v.priceOverride) : null,
                  stock_quantity: newStock,
                  is_active: v.isActive !== false,
                  attributes: v.attributes || null,
                })
                .select('id')
                .single();

              if (variantInsertError) throw variantInsertError;
              if (insertedNewVar?.id) {
                variantSkuToIdMap.set(expectedSku, insertedNewVar.id);
                void dispatchReadyBackInStockEmails(insertedNewVar.id);
                if (v.id) variantSkuToIdMap.set(v.id, insertedNewVar.id);
              }
            }
          }
        }

        // Variants removed in the editor are sent back with isActive=false. Keep their
        // rows and stock history for orders/auditability; the storefront ignores inactive variants.
        if (Array.isArray(variants) && variants.length > 0) {
          const submittedIds = new Set(variants.map((v: any) => String(v.id || '')).filter(Boolean));
          const submittedSkus = new Set(variants.map((v: any) => String(v.sku || '')).filter(Boolean));
          const { data: currentVariantRows, error: currentVariantRowsError } = await db
            .from('product_variants').select('id, sku, reserved_quantity').eq('product_id', id);
          if (currentVariantRowsError) throw currentVariantRowsError;
          for (const currentVariant of currentVariantRows || []) {
            if (submittedIds.has(String(currentVariant.id)) || submittedSkus.has(String(currentVariant.sku))) continue;
            if (Number(currentVariant.reserved_quantity || 0) > 0) {
              throw new Error(`Variant ${currentVariant.sku} has reserved inventory and cannot be removed until its orders are resolved.`);
            }
            const { error: archiveError } = await db.from('product_variants')
              .update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', currentVariant.id);
            if (archiveError) throw archiveError;
          }
        }

        // 4. Sync Images with variant association, role, and presentation adjustment
        if (Array.isArray(images) && images.length > 0) {
          const imageRows = images.map((img: any, idx: number) => {
            const matchedVarId = img.variantId || (img.variantSku ? variantSkuToIdMap.get(img.variantSku) : null) || null;
            return {
              product_id: id,
              variant_id: matchedVarId,
              image_url: img.imageUrl,
              alt_text: img.altText || product.name || currentProduct.name,
              is_primary: Boolean(img.isPrimary),
              sort_order: img.sortOrder || idx + 1,
              role: img.role || (idx === 0 ? 'hero' : 'gallery'),
              fit: img.fit || 'cover',
              focal_x: img.focalPositionX ?? img.focalX ?? img.focal_x ?? 50,
              focal_y: img.focalPositionY ?? img.focalY ?? img.focal_y ?? 50,
              scale: img.scale ? Number(img.scale) : 1.0,
            };
          });
          const { data: insertedImages, error: imageInsertError } = await db
            .from('product_images').insert(imageRows).select('id');
          if (imageInsertError) {
            res.status(500).json({ success: false, error: `Image save failed: ${imageInsertError.message}` });
            return;
          }
          const insertedIds = (insertedImages || []).map((r: any) => r.id).filter(Boolean);
          if (insertedIds.length > 0) {
            const { error: cleanupError } = await db.from('product_images')
              .delete().eq('product_id', id).not('id', 'in', `(${insertedIds.join(',')})`);
            if (cleanupError) {
              res.status(500).json({ success: false, error: `New images saved, but old image cleanup failed: ${cleanupError.message}` });
              return;
            }
          }
        }

        res.json({ success: true, product: updatedProd });
      } catch (err: any) {
        res.status(500).json({ success: false, error: err?.message || 'Error updating product.' });
      }
    }
  );


  // -------------------------------------------------------------------
  // 6. Frontend / Vite Middleware Mount
  // In development: mounts Vite dev middlewares
  // In production: serves pre-built dist assets with index.html SPA routing
  // -------------------------------------------------------------------
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist'), {
      setHeaders: (res, filePath) => {
        // Hashed build assets are immutable; index.html must always be revalidated so
        // visitors never keep a stale page that points at deleted CSS/JS bundles.
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        }
      },
    }));
    // A missing hashed asset must be a real 404, never the HTML shell (that causes the
    // "Refused to apply style ... MIME type text/html" error after a redeploy).
    app.use('/assets', (_req: Request, res: Response) => { res.status(404).type('text/plain').send('Not found'); });
    app.get('*', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  // Automatically release stock held by unpaid online checkouts (see sweepUnpaidOrders).
  void sweepUnpaidOrders(true);
  const unpaidSweepTimer = setInterval(() => { void sweepUnpaidOrders(true); }, 60_000);
  unpaidSweepTimer.unref?.();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VK VASTRAM server listening on http://0.0.0.0:${PORT} (online checkout stock hold: ${CHECKOUT_HOLD_MINUTES} min)`);
  });
}

startServer();

