import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  ArrowRight,
  ShoppingBag,
  ShieldCheck,
  CreditCard,
  Banknote,
  RotateCw,
  ExternalLink,
  UserPlus,
  Lock,
  Mail,
  AlertCircle,
  Printer,
} from 'lucide-react';
import { orderService } from '../../services/orderService';
import { paymentService } from '../../services/paymentService';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { OrderData, PageView } from '../../types';
import { formatPrice } from '../ui/PriceDisplay';
import { Button } from '../ui/Button';
import { Container } from '../ui/Container';
import { useSiteSettings } from '../../hooks/useSiteSettings';

interface OrderConfirmationPageProps {
  orderId: string;
  orderNumber: string;
  paymentVerified?: boolean;
  paymentMethod?: 'online' | 'cod';
  guestAccessToken?: string;
  onNavigate: (page: PageView) => void;
}

export const OrderConfirmationPage: React.FC<OrderConfirmationPageProps> = ({
  orderId,
  orderNumber,
  paymentVerified,
  paymentMethod: initialPaymentMethod,
  guestAccessToken: initialGuestToken,
  onNavigate,
}) => {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryingPayment, setRetryingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);

  const { settings } = useSiteSettings();
  const storeName = settings?.storeName || 'VK VASTRAM';

  // Optional Account Registration State for Guests
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);
  const [regError, setRegError] = useState('');

  const getActiveGuestToken = () => {
    if (initialGuestToken) {
      sessionStorage.setItem(`vk_guest_token_${orderId}`, initialGuestToken);
      return initialGuestToken;
    }
    return sessionStorage.getItem(`vk_guest_token_${orderId}`) || undefined;
  };

  const fetchOrder = async () => {
    const guestToken = getActiveGuestToken();
    const data = await orderService.getOrderById(orderId, undefined, guestToken);
    setOrder(data);
    if (data) {
      const email = data.customerEmail || data.shippingAddressSnapshot?.email || '';
      setRegEmail(email);
    }
    setLoading(false);
  };

  const handlePrintInvoice = () => {
    if (!order) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print your invoice.');
      return;
    }

    const itemsRows = (order.items || []).map(item => `
      <tr style="border-bottom: 1px solid #E5E7EB;">
        <td style="padding: 12px 0; font-family: serif; font-size: 14px;">
          <div style="font-weight: 500;">${item.productName}</div>
          <div style="font-size: 11px; color: #6B7280; font-family: monospace;">SKU: ${item.sku}</div>
        </td>
        <td style="padding: 12px 0; text-align: center; font-size: 13px;">${item.quantity}</td>
        <td style="padding: 12px 0; text-align: right; font-size: 13px; font-family: monospace;">₹${item.price.toLocaleString('en-IN')}</td>
        <td style="padding: 12px 0; text-align: right; font-size: 13px; font-family: monospace; font-weight: 600;">₹${(item.price * item.quantity).toLocaleString('en-IN')}</td>
      </tr>
    `).join('');

    const taglineHtml = `
      <div style="text-align: center; margin-top: 60px; padding-top: 24px; border-top: 1px dashed #D1D5DB; font-family: sans-serif;">
        <p style="font-family: serif; font-style: italic; font-size: 16px; margin: 0 0 8px 0; color: #1F2937;">
          ${settings?.thankYouNote || `Thank you for patronizing ${storeName}`}
        </p>
        <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600; margin: 0; color: ${settings?.taglineColor || '#967029'}; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
          <span>${settings?.tagline || 'Classical Indian Textiles & Sarees'}</span>
          ${settings?.taglineEmojis ? `<span style="font-size: 14px; margin-left: 4px;">${settings?.taglineEmojis}</span>` : ''}
        </p>
      </div>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice - ${order.orderNumber} - ${storeName}</title>
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111827; padding: 40px; max-width: 800px; margin: 0 auto; }
            table { width: 100%; border-collapse: collapse; }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #111827; padding-bottom: 20px;">
            <div>
              <h1 style="font-family: serif; font-size: 28px; font-weight: normal; margin: 0 0 4px 0; letter-spacing: 1px;">${storeName}</h1>
              <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: ${settings?.taglineColor || '#967029'}; margin: 0 0 8px 0; font-weight: 600;">
                ${settings?.tagline || 'Classical Indian Textiles & Sarees'} ${settings?.taglineEmojis || ''}
              </p>
              <p style="font-size: 12px; color: #4B5563; max-width: 320px; margin: 0; line-height: 1.4;">
                ${settings?.studioAddress || ''}
              </p>
            </div>
            <div style="text-align: right;">
              <h2 style="font-size: 20px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 10px 0; color: #111827;">Invoice / Receipt</h2>
              <p style="font-size: 13px; margin: 0 0 4px 0;"><strong>Order:</strong> ${order.orderNumber}</p>
              <p style="font-size: 13px; margin: 0 0 4px 0;"><strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString('en-IN', {day:'numeric', month:'long', year:'numeric'})}</p>
              <p style="font-size: 13px; margin: 0;"><strong>Status:</strong> ${order.orderStatus ? order.orderStatus.toUpperCase() : 'CONFIRMED'}</p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; font-size: 13px; line-height: 1.5;">
            <div>
              <h3 style="font-size: 11px; text-transform: uppercase; tracking: 1px; color: #6B7280; margin: 0 0 8px 0; font-weight: 600;">Deliver To</h3>
              <p style="font-weight: 600; margin: 0 0 4px 0; font-size: 14px;">${order.shippingAddressSnapshot?.recipientName || ''}</p>
              <p style="margin: 0 0 4px 0; color: #374151;">${order.shippingAddressSnapshot?.phone || ''}</p>
              <p style="margin: 0; color: #4B5563;">
                ${order.shippingAddressSnapshot?.addressLine1 || ''}<br/>
                ${order.shippingAddressSnapshot?.addressLine2 ? order.shippingAddressSnapshot.addressLine2 + '<br/>' : ''}
                ${order.shippingAddressSnapshot?.city || ''}, ${order.shippingAddressSnapshot?.state || ''} - ${order.shippingAddressSnapshot?.pincode || ''}
              </p>
            </div>
            <div style="text-align: right;">
              <h3 style="font-size: 11px; text-transform: uppercase; tracking: 1px; color: #6B7280; margin: 0 0 8px 0; font-weight: 600;">Payment & Shipping</h3>
              <p style="margin: 0 0 4px 0;"><strong>Payment Method:</strong> ${order.paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : 'Prepaid Online'}</p>
              <p style="margin: 0 0 4px 0;"><strong>Payment Status:</strong> ${order.paymentStatus === 'captured' ? 'Captured (Paid)' : 'Pending'}</p>
              <p style="margin: 0;"><strong>Shipping Method:</strong> Standard Premium Delivery</p>
            </div>
          </div>

          <table>
            <thead>
              <tr style="border-bottom: 2px solid #111827; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; color: #4B5563;">
                <th style="padding: 10px 0; text-align: left; font-weight: 600;">Item Details</th>
                <th style="padding: 10px 0; text-align: center; font-weight: 600; width: 80px;">Qty</th>
                <th style="padding: 10px 0; text-align: right; font-weight: 600; width: 120px;">Price</th>
                <th style="padding: 10px 0; text-align: right; font-weight: 600; width: 120px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div style="margin-top: 30px; display: flex; justify-content: flex-end; font-size: 13px;">
            <div style="width: 280px; line-height: 1.8;">
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px; margin-bottom: 6px;">
                <span>Subtotal</span>
                <span style="font-family: monospace;">₹${order.subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px; margin-bottom: 6px;">
                <span>Shipping</span>
                <span>${order.shippingAmount > 0 ? `<span style="font-family: monospace;">₹${order.shippingAmount.toLocaleString('en-IN')}</span>` : 'FREE'}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; padding-top: 4px;">
                <span>Grand Total</span>
                <span style="font-family: monospace;">₹${order.totalAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          ${taglineHtml}

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const effectivePaymentMethod = order?.paymentMethod || initialPaymentMethod || 'online';
  const isPaid = order?.paymentStatus === 'captured' || paymentVerified;

  const handleRetryPayment = async () => {
    if (!order) return;
    setRetryingPayment(true);
    setPaymentMessage(null);

    try {
      const guestToken = getActiveGuestToken();
      const rzpOrder = await paymentService.createRazorpayOrder(order.id, guestToken);
      if (!rzpOrder.success) {
        setPaymentMessage(rzpOrder.error || 'Unable to initialize Razorpay checkout.');
        setRetryingPayment(false);
        return;
      }

      await paymentService.openRazorpayCheckout({
        keyId: rzpOrder.keyId,
        razorpayOrderId: rzpOrder.razorpayOrderId,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency || 'INR',
        orderNumber: order.orderNumber,
        storeName: storeName,
        customerName: order.shippingAddressSnapshot?.recipientName,
        customerEmail: order.shippingAddressSnapshot?.email || '',
        customerPhone: order.shippingAddressSnapshot?.phone || '',
        onSuccess: async (response) => {
          setPaymentMessage('Verifying payment signature with server...');
          const verification = await paymentService.verifyPayment({
            orderId: order.id,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            guestAccessToken: guestToken,
          });

          if (verification.success && verification.verified) {
            setPaymentMessage('Payment successfully verified!');
            await fetchOrder();
          } else {
            setPaymentMessage('Payment signature verification failed.');
          }
          setRetryingPayment(false);
        },
        onDismiss: () => {
          setRetryingPayment(false);
          setPaymentMessage('Payment window was dismissed.');
        },
        onError: (err) => {
          setRetryingPayment(false);
          setPaymentMessage(err?.description || 'Payment error.');
        },
      });
    } catch (e: any) {
      setPaymentMessage(e.message || 'Payment error occurred.');
      setRetryingPayment(false);
    }
  };

  // Optional Account Registration for Guest Patrons
  const handleRegisterAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (!regEmail.trim() || !regEmail.includes('@')) {
      setRegError('Please provide a valid email address.');
      return;
    }

    if (regPassword.length < 6) {
      setRegError('Password must be at least 6 characters in length.');
      return;
    }

    setRegLoading(true);

    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.signUp({
          email: regEmail.trim(),
          password: regPassword,
          options: {
            data: {
              full_name: order?.shippingAddressSnapshot?.recipientName || order?.customerName || '',
              phone: order?.shippingAddressSnapshot?.phone || order?.customerPhone || '',
            },
          },
        });

        if (error) {
          if (error.message.includes('already registered')) {
            setRegError('An account with this email already exists. You can sign in to claim this order.');
          } else {
            setRegError(error.message);
          }
          setRegLoading(false);
          return;
        }

        if (data.user) {
          // Link this guest order
          await orderService.linkGuestOrders(data.user.id, regEmail.trim());
        }
      } else {
        // Local simulation
        const mockUserId = `cust-${Date.now()}`;
        await orderService.linkGuestOrders(mockUserId, regEmail.trim());
      }

      setRegSuccess(true);
      await fetchOrder();
    } catch (err: any) {
      setRegError(err?.message || 'Failed to create account.');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="py-16 bg-[#FAF8F5] min-h-[85vh]">
      <Container size="narrow">
        <div className="space-y-8">
          {/* Header Status Card */}
          <div className="text-center space-y-3 bg-[#FAF8F5] border border-[#1C1917]/10 p-8 rounded-xs shadow-2xs">
            <div
              className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${
                isPaid
                  ? 'bg-emerald-50 text-emerald-700'
                  : effectivePaymentMethod === 'cod'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {isPaid ? (
                <CheckCircle2 className="w-8 h-8" />
              ) : effectivePaymentMethod === 'cod' ? (
                <Banknote className="w-8 h-8" />
              ) : (
                <Clock className="w-8 h-8" />
              )}
            </div>

            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#967029] block">
              {isPaid
                ? 'Payment Verified & Order Confirmed'
                : effectivePaymentMethod === 'cod'
                ? 'Order Placed — Cash on Delivery'
                : 'Order Registered — Payment Pending'}
            </span>

            <h1 className="font-serif text-2xl sm:text-3xl text-[#1C1917] font-normal">
              {isPaid
                ? `Thank you for patronizing ${storeName}`
                : effectivePaymentMethod === 'cod'
                ? 'Your COD order is registered'
                : 'Your order request is reserved'}
            </h1>

            <p className="text-xs text-[#57534E] max-w-md mx-auto">
              {isPaid
                ? 'Your payment was cryptographically confirmed by our server. Your handloom package is being scheduled for bespoke wrapping.'
                : effectivePaymentMethod === 'cod'
                ? 'Your creation has entered the order processing queue. Please keep exact cash or UPI ready upon courier delivery.'
                : 'Your handloom order has been recorded in pending state. Complete payment below to finalize fulfillment.'}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4">
              <div className="inline-block bg-[#F4EFE6] border border-[#1C1917]/10 px-4 py-2 rounded-xs">
                <span className="text-[11px] text-[#78716C] block">Reference Order Number</span>
                <span className="font-mono text-sm font-bold text-[#1C1917] tracking-wider">
                  {orderNumber}
                </span>
              </div>
              
              {order && (
                <button
                  onClick={handlePrintInvoice}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#1C1917] hover:bg-[#2E2926] text-white text-xs font-semibold rounded-xs transition-colors cursor-pointer shadow-3xs h-[42px]"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print PDF Invoice</span>
                </button>
              )}
            </div>

            {/* Pending Payment Retry Callout */}
            {!isPaid && effectivePaymentMethod === 'online' && (
              <div className="pt-4 max-w-md mx-auto">
                <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xs space-y-2">
                  <p className="text-xs text-amber-900 font-medium">
                    Payment is still pending for this order.
                  </p>
                  {paymentMessage && (
                    <p className="text-[11px] text-amber-800">{paymentMessage}</p>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    loading={retryingPayment}
                    onClick={handleRetryPayment}
                    className="!bg-[#800020] hover:!bg-[#600018] w-full"
                    rightIcon={<CreditCard className="w-3.5 h-3.5" />}
                  >
                    Complete Payment via Razorpay
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Details Grid */}
          <div className="bg-[#FAF8F5] border border-[#1C1917]/10 rounded-xs p-6 shadow-2xs space-y-6">
            <h2 className="font-serif text-lg text-[#1C1917] font-medium border-b border-[#1C1917]/10 pb-3">
              Order Summary & Delivery Snapshot
            </h2>

            {/* Payment & Order Status Pill */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-[#F4EFE6] rounded-xs space-y-1">
                <span className="text-[10px] uppercase font-semibold text-[#78716C]">
                  Payment Status
                </span>
                <div className="flex items-center gap-2">
                  {isPaid ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Captured via Razorpay</span>
                    </span>
                  ) : effectivePaymentMethod === 'cod' ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
                      <Banknote className="w-3.5 h-3.5" />
                      <span>Cash on Delivery (Pending Delivery)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Online Payment Pending</span>
                    </span>
                  )}
                </div>
                {order?.payment?.providerPaymentId && (
                  <p className="text-[10px] font-mono text-[#78716C]">
                    Payment Ref: {order.payment.providerPaymentId}
                  </p>
                )}
              </div>

              <div className="p-4 bg-[#F4EFE6] rounded-xs space-y-1">
                <span className="text-[10px] uppercase font-semibold text-[#78716C]">
                  Order Fulfillment Status
                </span>
                <p className="font-semibold text-[#1C1917] capitalize">
                  {order?.orderStatus || (isPaid ? 'Confirmed' : 'Pending')}
                </p>
              </div>
            </div>

            {/* Delivery Address Snapshot */}
            {order?.shippingAddressSnapshot && (
              <div className="p-4 bg-[#F4EFE6] rounded-xs space-y-1 text-xs">
                <div className="flex items-center gap-1.5 text-[#967029] font-semibold text-[11px] uppercase tracking-wider mb-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Immutable Delivery Address Snapshot</span>
                </div>
                <p className="font-medium text-[#1C1917]">
                  {order.shippingAddressSnapshot.recipientName} ({order.shippingAddressSnapshot.phone})
                </p>
                <p className="text-[#57534E]">
                  {order.shippingAddressSnapshot.addressLine1}
                  {order.shippingAddressSnapshot.addressLine2 && `, ${order.shippingAddressSnapshot.addressLine2}`}
                </p>
                <p className="text-[#57534E]">
                  {order.shippingAddressSnapshot.city}, {order.shippingAddressSnapshot.state} — {order.shippingAddressSnapshot.pincode}
                </p>
              </div>
            )}

            {/* Items List */}
            {order?.items && order.items.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-[#1C1917] uppercase tracking-wider">
                  Purchased Items
                </h3>
                <div className="divide-y divide-[#1C1917]/10 text-xs">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {item.primaryImage && (
                          <img
                            src={item.primaryImage}
                            alt={item.productName}
                            className="w-10 h-12 object-cover rounded-xs bg-[#EFE9DC]"
                          />
                        )}
                        <div>
                          <p className="font-serif font-medium text-sm text-[#1C1917]">
                            {item.productName}
                          </p>
                          <p className="text-[10px] text-[#78716C] font-mono">
                            SKU: {item.sku} · Qty: {item.quantity}
                          </p>
                        </div>
                      </div>
                      <span className="font-medium tabular-nums text-[#1C1917]">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pricing Summary Breakdown */}
            {order && (
              <div className="border-t border-[#1C1917]/10 pt-4 space-y-2 text-xs">
                <div className="flex justify-between text-[#57534E]">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatPrice(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-[#57534E]">
                  <span>Shipping</span>
                  <span className="text-[#1C1917] font-medium">
                    {order.shippingAmount > 0 ? formatPrice(order.shippingAmount) : 'Calculated at checkout'}
                  </span>
                </div>
                <div className="border-t border-[#1C1917]/10 pt-2 flex justify-between items-baseline font-semibold text-[#1C1917] text-sm">
                  <span>Grand Total</span>
                  <span className="font-serif text-base tabular-nums">
                    {formatPrice(order.totalAmount)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Optional Account Registration Card for Guest Customers */}
          {(!order?.userId || order?.isGuest) && !regSuccess && (
            <div className="bg-[#FAF8F5] border border-[#967029]/30 rounded-xs p-6 shadow-2xs space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F4EFE6] text-[#967029] flex items-center justify-center shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-base text-[#1C1917] font-medium">
                    Create your VK VASTRAM account (Optional)
                  </h3>
                  <p className="text-xs text-[#57534E] mt-0.5 leading-relaxed">
                    Save your details for faster checkout and easy order tracking.
                  </p>
                </div>
              </div>

              {regError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              <form onSubmit={handleRegisterAccount} className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-[#57534E] mb-1">
                      Account Email
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-2.5" />
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="your-email@example.com"
                        className="w-full bg-[#F4EFE6] border border-[#1C1917]/10 text-xs pl-8 pr-3 py-2 rounded-xs focus:outline-none focus:border-[#967029]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-[#57534E] mb-1">
                      Create Password
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-2.5" />
                      <input
                        type="password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full bg-[#F4EFE6] border border-[#1C1917]/10 text-xs pl-8 pr-3 py-2 rounded-xs focus:outline-none focus:border-[#967029]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={regLoading}
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    Create Account
                  </Button>
                </div>
              </form>
            </div>
          )}

          {regSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  Account created successfully! This order is now saved to your order history.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate({ type: 'account', tab: 'orders' })}
              >
                View in Account
              </Button>
            </div>
          )}

          {/* Navigation Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {order?.userId && !order?.isGuest ? (
              <Button
                variant="outline"
                size="md"
                onClick={() => onNavigate({ type: 'account', tab: 'orders' })}
                leftIcon={<Package className="w-4 h-4" />}
              >
                View Order in Account
              </Button>
            ) : (
              <Button
                variant="outline"
                size="md"
                onClick={() =>
                  onNavigate({
                    type: 'login',
                    redirectAfter: { type: 'account', tab: 'orders' },
                  })
                }
                leftIcon={<Package className="w-4 h-4" />}
              >
                Sign In to Link Order
              </Button>
            )}

            <Button
              variant="primary"
              size="md"
              onClick={() => onNavigate({ type: 'home' })}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Continue Shopping
            </Button>
          </div>

          {/* Downmost Section: Thank You Tagline Block */}
          <div className="text-center pt-8 border-t border-[#1C1917]/10 mt-12 space-y-2">
            <p className="font-serif text-lg text-[#1C1917] italic">
              {settings?.thankYouNote || `Thank you for patronizing ${storeName}`}
            </p>
            <p 
              className="text-xs uppercase tracking-widest font-semibold flex items-center justify-center gap-1.5"
              style={{ color: settings?.taglineColor || '#967029' }}
            >
              <span>{settings?.tagline || 'Classical Indian Textiles & Sarees'}</span>
              {settings?.taglineEmojis && <span className="text-sm">{settings?.taglineEmojis}</span>}
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
};
