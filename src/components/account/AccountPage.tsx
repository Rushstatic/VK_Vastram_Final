import React, { useState, useEffect } from 'react';
import {
  User,
  MapPin,
  Package,
  Heart,
  LogOut,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Coins,
  ArrowRight,
  Clock,
  ExternalLink,
  CreditCard,
  Banknote,
  Printer,
} from 'lucide-react';
import { customerService } from '../../services/customerService';
import { orderService } from '../../services/orderService';
import { paymentService } from '../../services/paymentService';
import { AddressModal } from './AddressModal';
import { CustomerProfile, CustomerAddress, Product, PageView, OrderData } from '../../types';
import { formatPrice } from '../ui/PriceDisplay';
import { Button } from '../ui/Button';
import { Container } from '../ui/Container';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { buildInvoiceTaxRows } from '../../lib/invoiceTax';
import { OrderTrackingTimeline } from '../checkout/OrderTrackingTimeline';

interface AccountPageProps {
  userId: string;
  userEmail: string;
  initialTab?: 'profile' | 'addresses' | 'orders' | 'wishlist';
  wishlistedProducts: Product[];
  onNavigate: (page: PageView) => void;
  onLogout: () => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({
  userId,
  userEmail,
  initialTab = 'profile',
  wishlistedProducts,
  onNavigate,
  onLogout,
}) => {
  const { settings } = useSiteSettings();
  const storeName = settings?.storeName || 'VK VASTRAM';

  const [activeTab, setActiveTab] = useState<'profile' | 'addresses' | 'orders' | 'wishlist'>(
    initialTab
  );

  // Profile State
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  // Address State
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);

  // Orders State
  const [orders, setOrders] = useState<OrderData[]>([]);

  // Loading
  const [loading, setLoading] = useState(true);

  // Fetch initial profile, addresses & orders
  const loadAccountData = async () => {
    setLoading(true);
    const [prof, addrs, ords] = await Promise.all([
      customerService.getProfile(userId),
      customerService.getAddresses(userId),
      orderService.getCustomerOrders(userId),
    ]);

    if (prof) {
      setProfile(prof);
      setFullName(prof.fullName || '');
      setPhone(prof.phone || '');
      setCity(prof.city || '');
      setPincode(prof.pincode || '');
    } else {
      setProfile({
        id: userId,
        fullName: '',
        email: userEmail,
        loyaltyCoins: 0,
      });
    }

    setAddresses(addrs);
    setOrders(ords);
    setLoading(false);
  };

  useEffect(() => {
    loadAccountData();
    // Keep the customer-facing tracking timeline in sync with admin status updates.
    const trackingRefresh = window.setInterval(() => {
      void orderService.getCustomerOrders(userId).then(setOrders).catch(() => undefined);
    }, 30000);
    return () => window.clearInterval(trackingRefresh);
  }, [userId]);

  // Profile Save Handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage(null);

    const res = await customerService.updateProfile(userId, {
      fullName: fullName.trim(),
      phone: phone.trim(),
      city: city.trim(),
      pincode: pincode.trim(),
    });

    setProfileSaving(false);
    if (res.success) {
      setProfileMessage('Your profile details have been successfully updated.');
      setTimeout(() => setProfileMessage(null), 3000);
      loadAccountData();
    }
  };

  // Address Save Handler
  const handleSaveAddress = async (
    data: Omit<CustomerAddress, 'id' | 'userId'>,
    addressId?: string
  ) => {
    if (addressId) {
      const res = await customerService.updateAddress(userId, addressId, data);
      if (res.success) {
        loadAccountData();
        return true;
      }
      return false;
    } else {
      const res = await customerService.createAddress(userId, data);
      if (res.success) {
        loadAccountData();
        return true;
      }
      return false;
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (window.confirm('Are you sure you want to remove this delivery address?')) {
      await customerService.deleteAddress(userId, addressId);
      loadAccountData();
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    await customerService.setDefaultAddress(userId, addressId);
    loadAccountData();
  };

  const handlePrintInvoiceForOrder = (ord: OrderData) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print your invoice.');
      return;
    }

    const gstRowsHtml = buildInvoiceTaxRows(ord.items || [], settings?.gstin, ord.shippingAddressSnapshot?.state, ord.taxAmount);
    const itemsRows = (ord.items || []).map(item => `
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
          <title>Invoice - ${ord.orderNumber} - ${storeName}</title>
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111827; padding: 40px; max-width: 800px; margin: 0 auto; } .tax-note{font-size:10px;color:#6B7280;margin-top:8px;line-height:1.5}
            table { width: 100%; border-collapse: collapse; }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #111827; padding-bottom: 20px;">
            <div>
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;"><img src="${settings?.logoUrl || '/vk-vastram-logo.png'}" alt="VK VASTRAM logo" style="width:68px;height:68px;object-fit:contain;border-radius:4px;"/><h1 style="font-family: serif; font-size: 28px; font-weight: normal; margin: 0; letter-spacing: 1px;">${storeName}</h1></div>
              <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: ${settings?.taglineColor || '#967029'}; margin: 0 0 8px 0; font-weight: 600;">
                ${settings?.tagline || 'Classical Indian Textiles & Sarees'} ${settings?.taglineEmojis || ''}
              </p>
              <p style="font-size: 12px; color: #4B5563; max-width: 320px; margin: 0; line-height: 1.4;">
                ${settings?.studioAddress || ''}
                ${settings?.gstin ? `<br><strong>GSTIN:</strong> ${String(settings.gstin).replace(/[&<>\"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c] || c))}` : ''}
              </p>
            </div>
            <div style="text-align: right;">
              <h2 style="font-size: 20px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 10px 0; color: #111827;">Invoice / Receipt</h2>
              <p style="font-size: 13px; margin: 0 0 4px 0;"><strong>Order:</strong> ${ord.orderNumber}</p>
              <p style="font-size: 13px; margin: 0 0 4px 0;"><strong>Date:</strong> ${new Date(ord.createdAt).toLocaleDateString('en-IN', {day:'numeric', month:'long', year:'numeric'})}</p>
              <p style="font-size: 13px; margin: 0;"><strong>Status:</strong> ${ord.orderStatus ? ord.orderStatus.toUpperCase() : 'CONFIRMED'}</p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; font-size: 13px; line-height: 1.5;">
            <div>
              <h3 style="font-size: 11px; text-transform: uppercase; tracking: 1px; color: #6B7280; margin: 0 0 8px 0; font-weight: 600;">Deliver To</h3>
              <p style="font-weight: 600; margin: 0 0 4px 0; font-size: 14px;">${ord.shippingAddressSnapshot?.recipientName || ''}</p>
              <p style="margin: 0 0 4px 0; color: #374151;">${ord.shippingAddressSnapshot?.phone || ''}</p>
              <p style="margin: 0; color: #4B5563;">
                ${ord.shippingAddressSnapshot?.addressLine1 || ''}<br/>
                ${ord.shippingAddressSnapshot?.addressLine2 ? ord.shippingAddressSnapshot.addressLine2 + '<br/>' : ''}
                ${ord.shippingAddressSnapshot?.city || ''}, ${ord.shippingAddressSnapshot?.state || ''} - ${ord.shippingAddressSnapshot?.pincode || ''}
              </p>
            </div>
            <div style="text-align: right;">
              <h3 style="font-size: 11px; text-transform: uppercase; tracking: 1px; color: #6B7280; margin: 0 0 8px 0; font-weight: 600;">Payment & Shipping</h3>
              <p style="margin: 0 0 4px 0;"><strong>Payment Method:</strong> ${ord.paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : 'Prepaid Online'}</p>
              <p style="margin: 0 0 4px 0;"><strong>Payment Status:</strong> ${ord.paymentStatus === 'captured' ? 'Captured (Paid)' : 'Pending'}</p>
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
                <span>Item subtotal (GST-inclusive)</span>
                <span style="font-family: monospace;">₹${ord.subtotal.toLocaleString('en-IN')}</span>
              </div>
              ${gstRowsHtml}
              ${ord.discountAmount > 0 ? `<div style="display:flex;justify-content:space-between;border-bottom:1px solid #E5E7EB;padding-bottom:6px;margin-bottom:6px;color:#166534;"><span>Coupon discount</span><span style="font-family:monospace;">−₹${ord.discountAmount.toLocaleString('en-IN')}</span></div>` : ''}
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px; margin-bottom: 6px;">
                <span>Shipping</span>
                <span>${ord.shippingAmount > 0 ? `<span style="font-family: monospace;">₹${ord.shippingAmount.toLocaleString('en-IN')}</span>` : 'FREE'}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; padding-top: 4px;">
                <span>Grand Total</span>
                <span style="font-family: monospace;">₹${ord.totalAmount.toLocaleString('en-IN')}</span>
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

  return (
    <div className="py-12 bg-[#FAF8F5] min-h-[85vh]">
      <Container>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1C1917]/10 pb-6 mb-8">
          <div>
            <span className="text-[10px] uppercase font-semibold tracking-[0.2em] text-[#967029]">
              Patron Account
            </span>
            <h1 className="font-serif text-3xl text-[#1C1917] font-normal mt-1">
              Namaste, {profile?.fullName || userEmail.split('@')[0]}
            </h1>
            <p className="text-xs text-[#57534E] mt-0.5">{userEmail}</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Loyalty Coins Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#F4EFE6] border border-[#B88E3E]/30 rounded-xs text-xs">
              <Coins className="w-4 h-4 text-[#967029]" />
              <span className="font-medium text-[#1C1917]">
                {profile?.loyaltyCoins || 0}
              </span>
              <span className="text-[11px] text-[#78716C]">Vastram Coins</span>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={onLogout}
              leftIcon={<LogOut className="w-3.5 h-3.5" />}
            >
              Sign Out
            </Button>
          </div>
        </div>

        {/* Tab Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="space-y-1">
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xs text-xs font-medium transition-colors cursor-pointer text-left ${
                activeTab === 'profile'
                  ? 'bg-[#1C1917] text-[#FAF8F5] font-semibold'
                  : 'text-[#57534E] hover:bg-[#F4EFE6] hover:text-[#1C1917]'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Personal Profile</span>
            </button>

            <button
              onClick={() => setActiveTab('addresses')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xs text-xs font-medium transition-colors cursor-pointer text-left ${
                activeTab === 'addresses'
                  ? 'bg-[#1C1917] text-[#FAF8F5] font-semibold'
                  : 'text-[#57534E] hover:bg-[#F4EFE6] hover:text-[#1C1917]'
              }`}
            >
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4" />
                <span>Delivery Addresses</span>
              </div>
              <span className="text-[11px] tabular-nums font-mono opacity-80">
                {addresses.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xs text-xs font-medium transition-colors cursor-pointer text-left ${
                activeTab === 'orders'
                  ? 'bg-[#1C1917] text-[#FAF8F5] font-semibold'
                  : 'text-[#57534E] hover:bg-[#F4EFE6] hover:text-[#1C1917]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Package className="w-4 h-4" />
                <span>Orders & Shipments</span>
              </div>
              <span className="text-[11px] tabular-nums font-mono opacity-80">
                {orders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('wishlist')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xs text-xs font-medium transition-colors cursor-pointer text-left ${
                activeTab === 'wishlist'
                  ? 'bg-[#1C1917] text-[#FAF8F5] font-semibold'
                  : 'text-[#57534E] hover:bg-[#F4EFE6] hover:text-[#1C1917]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Heart className="w-4 h-4" />
                <span>Saved Wishlist</span>
              </div>
              <span className="text-[11px] tabular-nums font-mono opacity-80">
                {wishlistedProducts.length}
              </span>
            </button>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {/* 1. Profile Tab */}
            {activeTab === 'profile' && (
              <div className="bg-[#FAF8F5] border border-[#1C1917]/10 rounded-xs p-6 sm:p-8 space-y-6 shadow-2xs">
                <div className="relative overflow-hidden rounded-xl border border-[#B88E3E]/35 bg-gradient-to-br from-[#FFFEFB] via-[#F4EFE6] to-[#E9DFCF] p-5 sm:p-6 shadow-[0_12px_28px_-20px_rgba(28,25,23,0.45)]">
                  <div aria-hidden="true" className="pointer-events-none absolute -inset-y-10 -left-1/3 w-1/3 rotate-[18deg] bg-gradient-to-r from-transparent via-white/70 to-transparent vk-profile-sheen" />
                  <div className="relative flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <span className="text-[9px] uppercase tracking-[0.24em] text-[#967029] font-semibold">VK VASTRAM · MEMBER PROFILE</span>
                      <h3 className="font-serif text-xl sm:text-2xl text-[#1C1917] mt-2 truncate">{profile?.fullName || userEmail.split('@')[0]}</h3>
                      <p className="text-xs text-[#57534E] mt-1 truncate">{userEmail}</p>
                    </div>
                    <div className="shrink-0 w-10 h-10 rounded-full border border-[#B88E3E]/50 bg-[#FAF8F5]/70 flex items-center justify-center font-serif text-[#78281F]" aria-hidden="true">VK</div>
                  </div>
                  <div className="relative mt-5 pt-3 border-t border-[#B88E3E]/25 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-[#78716C]"><span>Personal details</span><span>Vastram Coins · {profile?.loyaltyCoins || 0}</span></div>
                </div>
                <div className="border-b border-[#1C1917]/10 pb-4">
                  <h2 className="font-serif text-xl text-[#1C1917] font-normal">
                    Personal Information
                  </h2>
                  <p className="text-xs text-[#78716C] mt-0.5">
                    Update your primary contact and delivery details.
                  </p>
                </div>

                {profileMessage && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{profileMessage}</span>
                  </div>
                )}

                <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-[#1C1917] mb-1.5">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Priyadarshini Rao"
                        className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2.5 rounded-xs text-[#1C1917]"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#1C1917] mb-1.5">
                        Registered Email
                      </label>
                      <input
                        type="email"
                        disabled
                        value={userEmail}
                        className="w-full bg-[#EFE9DC]/60 border border-[#1C1917]/10 p-2.5 rounded-xs text-[#78716C] cursor-not-allowed"
                      />
                      <span className="text-[10px] text-[#78716C] mt-1 block">
                        Account email is locked for security.
                      </span>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#1C1917] mb-1.5">
                        Contact Phone Number
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2.5 rounded-xs text-[#1C1917]"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#1C1917] mb-1.5">
                        City
                      </label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Bengaluru"
                        className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2.5 rounded-xs text-[#1C1917]"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#1C1917] mb-1.5">
                        Postal Pincode
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value)}
                        placeholder="560041"
                        className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2.5 rounded-xs text-[#1C1917] font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-[#1C1917]/10">
                    <Button
                      variant="primary"
                      size="md"
                      type="submit"
                      disabled={profileSaving}
                    >
                      {profileSaving ? 'Saving Changes...' : 'Save Profile Details'}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* 2. Addresses Tab */}
            {activeTab === 'addresses' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-serif text-xl text-[#1C1917] font-normal">
                      Delivery Addresses
                    </h2>
                    <p className="text-xs text-[#78716C]">
                      Manage multiple home and work shipping destinations.
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setEditingAddress(null);
                      setAddressModalOpen(true);
                    }}
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    Add Address
                  </Button>
                </div>

                {loading ? (
                  <div className="py-12 text-center text-xs text-[#78716C]">
                    Loading your saved addresses...
                  </div>
                ) : addresses.length === 0 ? (
                  <div className="p-8 text-center bg-[#FAF8F5] border border-dashed border-[#1C1917]/15 rounded-xs space-y-3">
                    <MapPin className="w-8 h-8 text-[#A8A29E] mx-auto" />
                    <p className="font-serif text-base text-[#1C1917]">No saved delivery addresses</p>
                    <p className="text-xs text-[#78716C] max-w-sm mx-auto">
                      Add a delivery address to ensure seamless delivery of your handloom creations.
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditingAddress(null);
                        setAddressModalOpen(true);
                      }}
                    >
                      + Add First Address
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className={`bg-[#FAF8F5] p-5 rounded-xs border relative flex flex-col justify-between ${
                          addr.isDefault
                            ? 'border-[#B88E3E] ring-1 ring-[#B88E3E]/50'
                            : 'border-[#1C1917]/10'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-semibold tracking-wider bg-[#F4EFE6] text-[#967029] px-2 py-0.5 rounded-xs">
                              {addr.label}
                            </span>
                            {addr.isDefault && (
                              <span className="text-[10px] uppercase font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-xs">
                                Default Delivery
                              </span>
                            )}
                          </div>

                          <div>
                            <p className="font-semibold text-sm text-[#1C1917]">
                              {addr.recipientName}
                            </p>
                            <p className="text-xs text-[#57534E] font-mono mt-0.5">
                              {addr.phone}
                            </p>
                          </div>

                          <div className="text-xs text-[#57534E] space-y-0.5 pt-1">
                            <p>{addr.addressLine1}</p>
                            {addr.addressLine2 && <p>{addr.addressLine2}</p>}
                            {addr.landmark && (
                              <p className="text-[#78716C]">Landmark: {addr.landmark}</p>
                            )}
                            <p className="font-medium text-[#1C1917]">
                              {addr.city}, {addr.state} — {addr.pincode}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-4 border-t border-[#1C1917]/10 mt-4 text-xs">
                          {!addr.isDefault && (
                            <button
                              onClick={() => handleSetDefaultAddress(addr.id)}
                              className="text-[11px] text-[#967029] hover:underline cursor-pointer"
                            >
                              Set as Default
                            </button>
                          )}
                          <div className="flex items-center gap-2 ml-auto">
                            <button
                              onClick={() => {
                                setEditingAddress(addr);
                                setAddressModalOpen(true);
                              }}
                              className="p-1.5 text-[#57534E] hover:text-[#1C1917] hover:bg-[#F4EFE6] rounded-xs cursor-pointer"
                              title="Edit address"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAddress(addr.id)}
                              className="p-1.5 text-[#78716C] hover:text-red-700 hover:bg-red-50 rounded-xs cursor-pointer"
                              title="Delete address"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Address Modal */}
                <AddressModal
                  isOpen={addressModalOpen}
                  onClose={() => setAddressModalOpen(false)}
                  addressToEdit={editingAddress}
                  onSave={handleSaveAddress}
                />
              </div>
            )}

            {/* 3. Orders Tab */}
            {activeTab === 'orders' && (
              <div className="space-y-6">
                <div className="border-b border-[#1C1917]/10 pb-4">
                  <h2 className="font-serif text-xl text-[#1C1917] font-normal">
                    Loom Orders & Shipment History
                  </h2>
                  <p className="text-xs text-[#78716C] mt-0.5">
                    Real-time status and invoices for your bespoke handloom pieces.
                  </p>
                </div>

                {loading ? (
                  <div className="py-12 text-center text-xs text-[#78716C]">
                    Loading your order history...
                  </div>
                ) : orders.length === 0 ? (
                  <div className="bg-[#FAF8F5] border border-dashed border-[#1C1917]/15 rounded-xs p-8 text-center space-y-4">
                    <Package className="w-10 h-10 text-[#A8A29E] mx-auto" />
                    <h3 className="font-serif text-base text-[#1C1917] font-normal">
                      No order records found
                    </h3>
                    <p className="text-xs text-[#57534E] max-w-sm mx-auto">
                      You have not placed any orders yet. Once placed, tracking numbers and detailed itemized invoices will be archived here.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onNavigate({ type: 'collection', category: 'sarees' })}
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                    >
                      Explore Catalog
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((ord) => (
                      <div
                        key={ord.id}
                        className="bg-[#FAF8F5] border border-[#1C1917]/10 rounded-xs p-5 shadow-2xs space-y-4"
                      >
                        {/* Order Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1C1917]/10 pb-3 text-xs">
                          <div>
                            <span className="text-[10px] text-[#78716C] block">Order Reference</span>
                            <span className="font-mono font-bold text-[#1C1917] tracking-wider">
                              {ord.orderNumber}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[#78716C] text-[11px]">
                              {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-xs text-[10px] uppercase tracking-wider font-semibold ${
                                ord.orderStatus === 'confirmed' || ord.orderStatus === 'delivered'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ord.orderStatus === 'cancelled'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {String(ord.orderStatus || 'pending').replaceAll('_', ' ')}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-xs text-[10px] uppercase tracking-wider font-semibold ${
                                ['captured', 'cod_collected', 'cod_settled'].includes(String(ord.paymentStatus || ''))
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ['failed', 'refunded'].includes(String(ord.paymentStatus || ''))
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {['captured', 'cod_collected'].includes(String(ord.paymentStatus || ''))
                                ? (String(ord.paymentStatus) === 'cod_collected' ? 'COD Collected' : 'Paid')
                                : String(ord.paymentStatus) === 'cod_settled'
                                ? 'COD Settled'
                                : String(ord.paymentStatus) === 'refunded'
                                ? 'Refunded'
                                : String(ord.paymentStatus) === 'failed'
                                ? 'Payment Failed'
                                : ord.paymentMethod === 'cod'
                                ? 'COD Pending'
                                : 'Payment Pending'}
                            </span>
                          </div>
                        </div>

                        {/* Order Items */}
                        <div className="divide-y divide-[#1C1917]/5 text-xs">
                          {(ord.items || []).map((item, idx) => (
                            <div key={idx} className="py-2.5 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                {item.primaryImage && (
                                  <img
                                    src={item.primaryImage}
                                    alt={item.productName}
                                    className="w-10 h-12 object-cover rounded-xs bg-[#EFE9DC] shrink-0 border border-[#1C1917]/5"
                                  />
                                )}
                                <div>
                                  <p className="font-serif font-medium text-sm text-[#1C1917]">
                                    {item.productName}
                                  </p>
                                  <p className="text-[10px] text-[#78716C] font-mono">
                                    SKU: {item.sku} · Qty: {item.quantity}
                                  </p>
                                  {item.productMetadata?.includeFallPico === true && (
                                    <p className="mt-1 pl-2 border-l-2 border-[#B88E3E] text-[10px] text-[#78281F]">Fall &amp; Pico × {item.quantity} · {formatPrice(Math.max(0, Number(settings?.fallPicoPrice) || 0) * item.quantity)}</p>
                                  )}
                                </div>
                              </div>
                              <span className="font-medium tabular-nums text-[#1C1917]">
                                {formatPrice(item.price * item.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>

                        <OrderTrackingTimeline status={ord.orderStatus} createdAt={ord.createdAt} shippedAt={ord.shippedAt} deliveredAt={ord.deliveredAt} courierName={ord.courierName} trackingNumber={ord.trackingNumber} trackingUrl={ord.trackingUrl} />

                        {(ord.courierName || ord.trackingNumber || ord.trackingUrl || ord.orderStatus === 'cancelled') && (
                          <div className={`rounded-xs border p-3 text-xs space-y-1 ${ord.orderStatus === 'cancelled' ? 'border-rose-200 bg-rose-50/70' : 'border-[#B88E3E]/25 bg-[#F4EFE6]/60'}`}>
                            {ord.orderStatus === 'cancelled' ? (
                              <>
                                <p className="font-semibold text-rose-800">This order has been cancelled.</p>
                                {ord.cancellationReason && <p className="text-[#57534E]">Reason: {ord.cancellationReason}</p>}
                                {ord.refundStatus && ord.refundStatus !== 'not_applicable' && <p className="text-[#57534E]">Refund status: <strong className="capitalize">{String(ord.refundStatus).replaceAll('_', ' ')}</strong>. Refunds are processed separately and may require additional time.</p>}
                              </>
                            ) : (
                              <>
                                <p className="font-semibold text-[#1C1917]">Shipment update</p>
                                {ord.courierName && <p className="text-[#57534E]">Courier: <strong>{ord.courierName}</strong></p>}
                                {ord.trackingNumber && <p className="text-[#57534E]">Tracking reference: <strong className="font-mono">{ord.trackingNumber}</strong></p>}
                                {ord.trackingUrl && <a href={ord.trackingUrl} target="_blank" rel="noreferrer" className="inline-block text-[#78281F] underline font-semibold">Track shipment ↗</a>}
                              </>
                            )}
                          </div>
                        )}

                        {/* Order Footer / Address & Total & Payment Actions */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#1C1917]/10 pt-3 text-xs">
                          <div className="text-[11px] text-[#78716C]">
                            {ord.shippingAddressSnapshot && (
                              <p>
                                Delivery to: <span className="text-[#1C1917] font-medium">{ord.shippingAddressSnapshot.recipientName}</span> ({ord.shippingAddressSnapshot.city} — {ord.shippingAddressSnapshot.pincode})
                              </p>
                            )}
                            <p className="text-[10px] text-[#78716C] mt-0.5">
                              Method: {ord.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Razorpay Online Payment'}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-auto">
                            <button
                              onClick={() => handlePrintInvoiceForOrder(ord)}
                              className="px-2.5 py-1.5 bg-white border border-[#1C1917]/15 text-[#1C1917] hover:bg-[#F4EFE6] text-[11px] font-semibold rounded-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Print Invoice</span>
                            </button>

                            <div className="text-right">
                              <span className="text-[10px] text-[#78716C] block">Total Amount</span>
                              <span className="font-serif font-bold text-sm text-[#1C1917] tabular-nums">
                                {formatPrice(ord.totalAmount)}
                              </span>
                            </div>

                            {ord.paymentStatus !== 'captured' && ord.paymentMethod !== 'cod' && (
                              <button
                                onClick={async () => {
                                  try {
                                    const rzpOrder = await paymentService.createRazorpayOrder(ord.id);
                                    if (rzpOrder.success) {
                                      await paymentService.openRazorpayCheckout({
                                        keyId: rzpOrder.keyId,
                                        razorpayOrderId: rzpOrder.razorpayOrderId,
                                        amount: rzpOrder.amount,
                                        currency: rzpOrder.currency || 'INR',
                                        orderNumber: ord.orderNumber,
                                        customerName: ord.shippingAddressSnapshot?.recipientName,
                                        customerPhone: ord.shippingAddressSnapshot?.phone,
                                        onSuccess: async (response) => {
                                          await paymentService.verifyPayment({
                                            orderId: ord.id,
                                            razorpayOrderId: response.razorpay_order_id,
                                            razorpayPaymentId: response.razorpay_payment_id,
                                            razorpaySignature: response.razorpay_signature,
                                          });
                                          loadAccountData();
                                        },
                                      });
                                    }
                                  } catch (err) {
                                    console.error('Error retrying payment:', err);
                                  }
                                }}
                                className="px-3 py-1.5 bg-[#800020] hover:bg-[#600018] text-white rounded-xs text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Pay Now</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 4. Wishlist Tab */}
            {activeTab === 'wishlist' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#1C1917]/10 pb-4">
                  <div>
                    <h2 className="font-serif text-xl text-[#1C1917] font-normal">
                      Saved Handloom Favorites
                    </h2>
                    <p className="text-xs text-[#78716C]">
                      Pieces you have curated for future celebrations.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onNavigate({ type: 'wishlist' })}
                  >
                    View Full Wishlist Grid
                  </Button>
                </div>

                {wishlistedProducts.length === 0 ? (
                  <div className="p-8 text-center bg-[#FAF8F5] border border-dashed border-[#1C1917]/15 rounded-xs space-y-2">
                    <Heart className="w-8 h-8 text-[#A8A29E] mx-auto" />
                    <p className="font-serif text-base text-[#1C1917]">Your wishlist is currently empty</p>
                    <p className="text-xs text-[#78716C]">
                      Click the heart icon on any saree or bedding creation to save it here.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {wishlistedProducts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => onNavigate({ type: 'product', slug: p.slug })}
                        className="bg-[#FAF8F5] p-3 rounded-xs border border-[#1C1917]/10 hover:border-[#B88E3E] transition-all cursor-pointer flex gap-3"
                      >
                        <img
                          src={p.primaryImage}
                          alt={p.name}
                          className="w-16 h-20 object-cover rounded-xs bg-[#EFE9DC] shrink-0"
                        />
                        <div className="min-w-0 flex flex-col justify-between py-0.5">
                          <div>
                            <p className="font-serif text-sm font-medium text-[#1C1917] line-clamp-1">
                              {p.name}
                            </p>
                            <span className="text-[11px] text-[#78716C]">{p.categoryLabel}</span>
                          </div>
                          <p className="font-semibold text-xs text-[#1C1917]">
                            ₹{p.price.toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
};
