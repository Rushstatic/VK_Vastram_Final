import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  ShieldCheck,
  MapPin,
  CreditCard,
  Truck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Plus,
  Lock,
  ShoppingBag,
  RotateCw,
  Banknote,
  Mail,
  Phone,
} from 'lucide-react';
import { CartItem, CustomerAddress, CustomerProfile, PageView } from '../../types';
import { customerService } from '../../services/customerService';
import { orderService, CheckoutValidationResult } from '../../services/orderService';
import { paymentService } from '../../services/paymentService';
import { cartService } from '../../services/cartService';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { AddressModal } from '../account/AddressModal';
import { AddressAutocompleteInput } from '../common/AddressAutocompleteInput';
import { validateIndianMobile, validateEmail, validateIndianPincode } from '../../lib/validation';
import { formatPrice } from '../ui/PriceDisplay';
import { Button } from '../ui/Button';
import { Container } from '../ui/Container';

interface CheckoutPageProps {
  items: CartItem[];
  userId?: string;
  userEmail?: string;
  onNavigate: (page: PageView) => void;
  onOrderSuccess: (
    orderId: string,
    orderNumber: string,
    options?: { paymentVerified?: boolean; paymentMethod?: 'online' | 'cod'; guestAccessToken?: string }
  ) => void;
}

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

export const CheckoutPage: React.FC<CheckoutPageProps> = ({
  items,
  userId,
  userEmail,
  onNavigate,
  onOrderSuccess,
}) => {
  // Step Progression: 1: Patron/Contact, 2: Address, 3: Review, 4: Payment
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Effective Cart Items (guaranteed fallback from local cart storage if transition is immediate)
  const cartItems = items && items.length > 0 ? items : cartService.getGuestCart();

  // Authenticated State
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressModalOpen, setAddressModalOpen] = useState(false);

  // Guest Contact State
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  // Guest Address State
  const [guestAddressLine1, setGuestAddressLine1] = useState('');
  const [guestAddressLine2, setGuestAddressLine2] = useState('');
  const [guestLandmark, setGuestLandmark] = useState('');
  const [guestCity, setGuestCity] = useState('');
  const [guestState, setGuestState] = useState('Maharashtra');
  const [guestPincode, setGuestPincode] = useState('');

  // Payment Selection
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
  const [couponInput, setCouponInput] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [codEnabled, setCodEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    const loadCodSetting = async () => {
      if (!isSupabaseConfigured()) return;
      const { data } = await (supabase as any).from('site_settings').select('value').eq('key', 'policies').maybeSingle();
      if (active) {
        const enabled = data?.value?.cod_enabled === true;
        setCodEnabled(enabled);
        if (!enabled) setPaymentMethod('online');
      }
    };
    void loadCodSetting();
    const onSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (typeof detail?.codEnabled === 'boolean') { setCodEnabled(detail.codEnabled); if (!detail.codEnabled) setPaymentMethod('online'); }
    };
    window.addEventListener('vk_settings_updated', onSettingsUpdated);
    return () => { active = false; window.removeEventListener('vk_settings_updated', onSettingsUpdated); };
  }, []);
  const [orderNotes, setOrderNotes] = useState('');

  // Validation & Order Lifecycle
  const [validation, setValidation] = useState<CheckoutValidationResult | null>(null);
  const [validating, setValidating] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const { settings } = useSiteSettings();
  const storeName = settings?.storeName || 'VK VASTRAM';
  const announcementText = settings?.announcementBarText || 'Shipping charges calculated at checkout.';

  // Step validation errors
  const [step1Errors, setStep1Errors] = useState<{ name?: string; email?: string; phone?: string }>({});
  const [step2Errors, setStep2Errors] = useState<{ addressLine1?: string; city?: string; pincode?: string }>({});

  // In-progress pending order (for safe payment retry without duplicate orders)
  const [activePendingOrder, setActivePendingOrder] = useState<{
    id: string;
    orderNumber: string;
  } | null>(null);

  // Initial Fetch & Cart Validation
  useEffect(() => {
    const initCheckout = async () => {
      setValidating(true);
      setErrorMessage('');

      // 1. Re-validate cart items against authoritative database prices and stock
      const effectiveList = items && items.length > 0 ? items : cartService.getGuestCart();
      const valResult = await orderService.validateCheckoutCart(effectiveList);
      setValidation(valResult);

      if (!valResult.isValid && valResult.stockErrorMessage) {
        setErrorMessage(valResult.stockErrorMessage);
      }

      // 2. Load Customer Profile & Saved Addresses if authenticated
      if (userId) {
        const [prof, addrs] = await Promise.all([
          customerService.getProfile(userId),
          customerService.getAddresses(userId),
        ]);
        setProfile(prof);
        setAddresses(addrs);

        const defaultAddr = addrs.find((a) => a.isDefault) || addrs[0];
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id);
        }

        // Authenticated customer can start at Step 2 (Address selection)
        setCurrentStep(2);
      } else {
        // Guest customer starts at Step 1 (Contact info)
        setCurrentStep(1);
      }

      setValidating(false);
    };

    initCheckout();
  }, [userId, items]);

  // Handle Address Save for authenticated patron
  const handleSaveAddress = async (
    data: Omit<CustomerAddress, 'id' | 'userId'>
  ) => {
    if (!userId) return false;
    const res = await customerService.createAddress(userId, data);
    if (res.success && res.addressId) {
      const updated = await customerService.getAddresses(userId);
      setAddresses(updated);
      setSelectedAddressId(res.addressId);
      return true;
    }
    return false;
  };

  /**
   * Validate Step 1 (Contact Info for Guest)
   */
  const validateStep1 = (): boolean => {
    if (userId) return true;

    const errors: { name?: string; email?: string; phone?: string } = {};

    if (!guestName.trim()) {
      errors.name = 'Full name is required.';
    }

    const phoneVal = validateIndianMobile(guestPhone);
    if (!phoneVal.isValid) {
      errors.phone = phoneVal.error || 'Enter a valid 10-digit mobile number.';
    } else {
      setGuestPhone(phoneVal.normalized);
    }

    if (guestEmail.trim()) {
      const emailVal = validateEmail(guestEmail);
      if (!emailVal.isValid) {
        errors.email = emailVal.error || 'Enter a valid email address.';
      } else {
        setGuestEmail(emailVal.normalized);
      }
    }

    setStep1Errors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Validate Step 2 (Delivery Address for Guest)
   */
  const validateStep2 = (): boolean => {
    if (userId) {
      if (!selectedAddressId) {
        setErrorMessage('Please select or add a delivery address to proceed.');
        return false;
      }
      return true;
    }

    const errors: { addressLine1?: string; city?: string; pincode?: string } = {};

    if (!guestAddressLine1.trim()) {
      errors.addressLine1 = 'Street address or flat number is required.';
    }

    if (!guestCity.trim()) {
      errors.city = 'City or town is required.';
    }

    const pinVal = validateIndianPincode(guestPincode);
    if (!pinVal.isValid) {
      errors.pincode = pinVal.error || 'Valid 6-digit Indian PIN code is required.';
    } else {
      setGuestPincode(pinVal.normalized);
    }

    setStep2Errors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Build effective shipping address snapshot
   */
  const getEffectiveShippingAddress = (): CustomerAddress | null => {
    if (userId) {
      return addresses.find((a) => a.id === selectedAddressId) || null;
    }

    return {
      id: 'guest-address',
      label: 'Home',
      recipientName: guestName.trim() || 'Valued Patron',
      phone: guestPhone.trim(),
      email: guestEmail.trim() || undefined,
      addressLine1: guestAddressLine1.trim(),
      addressLine2: guestAddressLine2.trim() || undefined,
      landmark: guestLandmark.trim() || undefined,
      city: guestCity.trim(),
      state: guestState,
      pincode: guestPincode.trim(),
      isDefault: true,
    };
  };

  /**
   * Launch Razorpay Checkout for a pending order
   */
  const launchRazorpayFlow = async (
    orderId: string,
    orderNumber: string,
    guestAccessToken?: string
  ) => {
    setSubmitting(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      // 1. Create Razorpay Order on server side
      const rzpOrder = await paymentService.createRazorpayOrder(orderId, guestAccessToken);

      if (!rzpOrder.success || !rzpOrder.razorpayOrderId) {
        setErrorMessage(
          rzpOrder.error || 'Unable to initiate payment with Razorpay. Please try again.'
        );
        setSubmitting(false);
        return;
      }

      const shippingAddr = getEffectiveShippingAddress();
      const recipientName =
        rzpOrder.customerName ||
        shippingAddr?.recipientName ||
        guestName ||
        profile?.fullName ||
        'Valued Patron';
      const contactPhone =
        rzpOrder.customerPhone || shippingAddr?.phone || guestPhone || profile?.phone || '';
      const contactEmail =
        rzpOrder.customerEmail || guestEmail || userEmail || '';

      // 2. Open official Razorpay Checkout modal
      const opened = await paymentService.openRazorpayCheckout({
        keyId: rzpOrder.keyId,
        razorpayOrderId: rzpOrder.razorpayOrderId,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency || 'INR',
        orderNumber: orderNumber,
        storeName: storeName,
        customerName: recipientName,
        customerEmail: contactEmail,
        customerPhone: contactPhone,
        notes: {
          orderId,
          orderNumber,
        },
        onSuccess: async (response) => {
          setVerifyingPayment(true);
          setInfoMessage('Payment received. Verifying cryptographic signature with server...');

          // 3. Server-side signature verification
          const verification = await paymentService.verifyPayment({
            orderId,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            guestAccessToken,
          });

          setVerifyingPayment(false);

          if (verification.success && verification.verified) {
            onOrderSuccess(orderId, orderNumber, {
              paymentVerified: true,
              paymentMethod: 'online',
              guestAccessToken,
            });
          } else {
            setErrorMessage(
              verification.error ||
                'Payment signature could not be verified by server. Your order remains pending.'
            );
          }
        },
        onDismiss: () => {
          setSubmitting(false);
          setInfoMessage(
            `Payment process was cancelled. Order #${orderNumber} is preserved in pending state. You may retry payment now or later.`
          );
        },
        onError: (err) => {
          setSubmitting(false);
          console.warn('Razorpay error in checkout:', err);
          setErrorMessage(
            err?.description ||
              'Payment could not be completed. Your order has not been marked as paid.'
          );
        },
      });

      if (!opened) {
        setErrorMessage('Failed to initialize Razorpay checkout window. Please check your browser.');
        setSubmitting(false);
      }
    } catch (err: any) {
      console.error('Error during Razorpay flow:', err);
      setErrorMessage(err?.message || 'An unexpected error occurred during payment processing.');
      setSubmitting(false);
    }
  };

  /**
   * Main Place Order / Checkout Handler
   */
  const handlePlaceOrder = async () => {
    // Validate Step 1 & 2
    if (!validateStep1()) {
      setCurrentStep(1);
      return;
    }

    if (!validateStep2()) {
      setCurrentStep(2);
      return;
    }

    const shippingAddress = getEffectiveShippingAddress();
    if (!shippingAddress) {
      setErrorMessage('Please provide a complete delivery address.');
      setCurrentStep(2);
      return;
    }

    // If customer already has an active pending order from a previous attempt, retry against it
    if (paymentMethod === 'online' && activePendingOrder) {
      await launchRazorpayFlow(activePendingOrder.id, activePendingOrder.orderNumber);
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      // 1. Create order in VK VASTRAM database first (Server-authoritative coupon redemption)
      const res = await orderService.createOrder({
        userId,
        customerName: userId ? profile?.fullName : guestName.trim(),
        customerEmail: userId ? userEmail : guestEmail.trim(),
        customerPhone: userId ? profile?.phone : guestPhone.trim(),
        shippingAddress,
        billingAddress: shippingAddress,
        items: validation?.validatedItems || cartItems,
        paymentMethod,
        couponCode: couponCode || undefined,
        notes: orderNotes.trim() || undefined,
      });

      if (!res.success || !res.orderId || !res.orderNumber) {
        setErrorMessage(res.error || 'Failed to place order. Please try again.');
        setSubmitting(false);
        return;
      }

      const createdOrderId = res.orderId;
      const createdOrderNumber = res.orderNumber;
      const guestAccessToken = res.guestAccessToken;

      if (guestAccessToken && typeof window !== 'undefined') {
        sessionStorage.setItem(`vk_guest_token_${createdOrderId}`, guestAccessToken);
      }

      setActivePendingOrder({ id: createdOrderId, orderNumber: createdOrderNumber });

      // 2. Route based on payment method
      if (paymentMethod === 'cod') {
        setSubmitting(false);
        onOrderSuccess(createdOrderId, createdOrderNumber, {
          paymentVerified: false,
          paymentMethod: 'cod',
          guestAccessToken,
        });
      } else {
        // Online Payment: Launch Razorpay Server-Side Order & Checkout
        await launchRazorpayFlow(createdOrderId, createdOrderNumber, guestAccessToken);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during checkout.');
      setSubmitting(false);
    }
  };

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) { setCouponMessage('Enter a coupon code first.'); return; }
    setCouponBusy(true); setCouponMessage('');
    try {
      const response = await fetch('/api/coupons/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, items: cartItems.map((i) => ({ product_id: i.product.id, variant_id: i.variantId, quantity: i.quantity })), email: userEmail || guestEmail.trim() || undefined }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) { setCouponCode(''); setCouponDiscount(0); setCouponMessage(data.error || 'Coupon could not be applied.'); return; }
      setCouponCode(code); setCouponDiscount(Number(data.discountAmount) || 0); setCouponMessage(data.message || 'Coupon applied successfully.');
    } catch { setCouponMessage('Unable to validate coupon right now. Please try again.'); }
    finally { setCouponBusy(false); }
  };

  // Empty Cart Guard (unless currently in-flight payment)
  if (cartItems.length === 0 && !activePendingOrder && !verifyingPayment) {
    return (
      <div className="py-20 bg-[#FAF8F5] min-h-[70vh] flex items-center justify-center">
        <Container size="narrow">
          <div className="text-center space-y-4 max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#F4EFE6] text-[#967029] flex items-center justify-center">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl text-[#1C1917] font-normal">
              Your Bag is Empty
            </h1>
            <p className="text-xs text-[#57534E] leading-relaxed">
              Please add handloom sarees or artisanal bedsheets to your bag before proceeding to checkout.
            </p>
            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => onNavigate({ type: 'collection', category: 'sarees' })}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Explore Collection
              </Button>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  const subtotal =
    validation?.authoritativeSubtotal ||
    cartItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  return (
    <div className="py-12 bg-[#FAF8F5] min-h-[85vh]">
      <Container>
        {/* Header */}
        <div className="border-b border-[#1C1917]/10 pb-6 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase font-semibold tracking-[0.2em] text-[#967029]">
              {storeName} Bespoke Checkout
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl text-[#1C1917] font-normal mt-1">
              Secure Delivery & Payment
            </h1>
          </div>
          <button
            onClick={() => onNavigate({ type: 'cart' })}
            className="inline-flex items-center gap-1.5 text-xs text-[#78716C] hover:text-[#1C1917] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Shopping Bag</span>
          </button>
        </div>

        {/* Free-delivery progress, driven by the admin-configured site setting. */}
        {Number(settings?.freeShippingThreshold || 0) > 0 && (
          <div className="mb-5 rounded-xs border border-[#B88E3E]/30 bg-[#F4EFE6] px-4 py-3 text-xs text-[#57534E]">
            {Math.max(0, Number(settings?.freeShippingThreshold || 0) - Math.max(0, subtotal - couponDiscount)) > 0 ? (
              <>Add <strong className="text-[#78281F]">{formatPrice(Math.max(0, Number(settings?.freeShippingThreshold || 0) - Math.max(0, subtotal - couponDiscount)))}</strong> more to unlock free delivery.</>
            ) : (
              <strong className="text-emerald-800">You have unlocked free delivery!</strong>
            )}
          </div>
        )}

        {/* Global Notifications */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {infoMessage && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xs flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 shrink-0 text-[#967029]" />
              <span>{infoMessage}</span>
            </div>
            {activePendingOrder && (
              <button
                onClick={() =>
                  launchRazorpayFlow(activePendingOrder.id, activePendingOrder.orderNumber)
                }
                className="px-3 py-1 bg-[#800020] text-white text-[11px] font-medium rounded-xs hover:bg-[#600018] cursor-pointer"
              >
                Retry Payment Now
              </button>
            )}
          </div>
        )}

        {validation?.hasPriceChanges && validation.priceChangeMessages && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xs space-y-1">
            <p className="font-semibold">Catalog Price Adjustment Notice:</p>
            {validation.priceChangeMessages.map((msg, i) => (
              <p key={i}>• {msg}</p>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Progression Column */}
          <div className="lg:col-span-8 space-y-6">
            {/* Step 1: Patron Contact Details */}
            <div className="bg-[#FAF8F5] border border-[#1C1917]/10 rounded-xs p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#1C1917]/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center ${
                      currentStep === 1
                        ? 'bg-[#1C1917] text-[#FAF8F5]'
                        : 'bg-emerald-700 text-white'
                    }`}
                  >
                    {currentStep > 1 ? '✓' : '1'}
                  </span>
                  <h2 className="font-serif text-base text-[#1C1917] font-medium">
                    1. Contact Information
                  </h2>
                </div>
                {userId ? (
                  <span className="text-[11px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-xs font-medium">
                    Authenticated Patron
                  </span>
                ) : (
                  <span className="text-[11px] text-[#78716C] bg-[#F4EFE6] px-2 py-0.5 rounded-xs font-medium">
                    Guest Checkout (No account required)
                  </span>
                )}
              </div>

              {userId ? (
                <div className="text-xs text-[#57534E] flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[#1C1917]">{profile?.fullName || userEmail}</p>
                    <p className="text-[11px] text-[#78716C]">{userEmail}</p>
                    {profile?.phone && <p className="text-[11px] text-[#78716C]">{profile.phone}</p>}
                  </div>
                  <button
                    onClick={() => onNavigate({ type: 'account', tab: 'profile' })}
                    className="text-[11px] text-[#967029] hover:underline cursor-pointer"
                  >
                    Edit Profile
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-[#F4EFE6]/60 border border-[#1C1917]/5 rounded-xs flex items-center justify-between text-xs">
                    <span className="text-[#57534E]">
                      Already have a {storeName} account?
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate({ type: 'login', redirectAfter: { type: 'checkout' } })
                      }
                      className="text-xs font-medium text-[#967029] hover:underline cursor-pointer"
                    >
                      Sign In for Saved Addresses
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={guestName}
                        onChange={(e) => {
                          setGuestName(e.target.value);
                          if (step1Errors.name) setStep1Errors({ ...step1Errors, name: undefined });
                        }}
                        placeholder="e.g. Priyadarshini Rao"
                        className={`w-full bg-[#FAF8F5] border text-xs px-3 py-2 rounded-xs focus:outline-none ${
                          step1Errors.name
                            ? 'border-red-400 focus:border-red-500'
                            : 'border-[#1C1917]/20 focus:border-[#967029]'
                        }`}
                      />
                      {step1Errors.name && (
                        <p className="text-[11px] text-red-600 mt-1">{step1Errors.name}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                        Mobile Number (+91) *
                      </label>
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-2.5" />
                        <input
                          type="tel"
                          value={guestPhone}
                          onChange={(e) => {
                            setGuestPhone(e.target.value);
                            if (step1Errors.phone) setStep1Errors({ ...step1Errors, phone: undefined });
                          }}
                          placeholder="98765 43210"
                          maxLength={15}
                          className={`w-full bg-[#FAF8F5] border text-xs pl-8 pr-3 py-2 rounded-xs focus:outline-none ${
                            step1Errors.phone
                              ? 'border-red-400 focus:border-red-500'
                              : 'border-[#1C1917]/20 focus:border-[#967029]'
                          }`}
                        />
                      </div>
                      {step1Errors.phone && (
                        <p className="text-[11px] text-red-600 mt-1">{step1Errors.phone}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                        Email Address (For receipts & tracking) *
                      </label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-2.5" />
                        <input
                          type="email"
                          value={guestEmail}
                          onChange={(e) => {
                            setGuestEmail(e.target.value);
                            if (step1Errors.email) setStep1Errors({ ...step1Errors, email: undefined });
                          }}
                          placeholder="patron@example.com"
                          className={`w-full bg-[#FAF8F5] border text-xs pl-8 pr-3 py-2 rounded-xs focus:outline-none ${
                            step1Errors.email
                              ? 'border-red-400 focus:border-red-500'
                              : 'border-[#1C1917]/20 focus:border-[#967029]'
                          }`}
                        />
                      </div>
                      {step1Errors.email && (
                        <p className="text-[11px] text-red-600 mt-1">{step1Errors.email}</p>
                      )}
                    </div>
                  </div>

                  {currentStep === 1 && (
                    <div className="pt-2 flex justify-end">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          if (validateStep1()) {
                            setCurrentStep(2);
                          }
                        }}
                        rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                      >
                        Proceed to Delivery Address
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Delivery Address */}
            <div className="bg-[#FAF8F5] border border-[#1C1917]/10 rounded-xs p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#1C1917]/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center ${
                      currentStep === 2
                        ? 'bg-[#1C1917] text-[#FAF8F5]'
                        : currentStep > 2
                        ? 'bg-emerald-700 text-white'
                        : 'bg-[#E7E5E4] text-[#78716C]'
                    }`}
                  >
                    {currentStep > 2 ? '✓' : '2'}
                  </span>
                  <h2 className="font-serif text-base text-[#1C1917] font-medium">
                    2. Delivery Address
                  </h2>
                </div>
                {userId && currentStep >= 2 && (
                  <button
                    onClick={() => setAddressModalOpen(true)}
                    className="inline-flex items-center gap-1 text-xs text-[#967029] hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add New Address</span>
                  </button>
                )}
              </div>

              {userId ? (
                /* Authenticated Address Book */
                addresses.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-[#1C1917]/20 rounded-xs space-y-2">
                    <p className="text-xs text-[#57534E]">
                      No delivery addresses saved in your patron book.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setAddressModalOpen(true)}
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                    >
                      Add Shipping Address
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {addresses.map((addr) => (
                        <label
                          key={addr.id}
                          className={`p-4 border rounded-xs cursor-pointer text-xs space-y-1 block transition-all ${
                            selectedAddressId === addr.id
                              ? 'border-[#967029] bg-[#F4EFE6]/60 shadow-2xs'
                              : 'border-[#1C1917]/10 hover:border-[#1C1917]/30'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-[#1C1917]">{addr.recipientName}</span>
                            <input
                              type="radio"
                              name="shippingAddress"
                              checked={selectedAddressId === addr.id}
                              onChange={() => setSelectedAddressId(addr.id)}
                              className="accent-[#967029]"
                            />
                          </div>
                          <p className="text-[#57534E] text-[11px] leading-relaxed">
                            {addr.addressLine1}
                            {addr.addressLine2 && `, ${addr.addressLine2}`}
                            {addr.landmark && ` (Near ${addr.landmark})`}
                          </p>
                          <p className="text-[#57534E] text-[11px]">
                            {addr.city}, {addr.state} — {addr.pincode}
                          </p>
                          <p className="text-[#78716C] text-[10px] pt-1">Phone: {addr.phone}</p>
                        </label>
                      ))}
                    </div>

                    {currentStep === 2 && (
                      <div className="pt-2 flex justify-between items-center">
                        <button
                          type="button"
                          onClick={() => setCurrentStep(1)}
                          className="text-xs text-[#78716C] hover:text-[#1C1917] cursor-pointer"
                        >
                          ← Back to Contact
                        </button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            if (validateStep2()) {
                              setCurrentStep(3);
                            }
                          }}
                          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                        >
                          Proceed to Review & Shipping
                        </Button>
                      </div>
                    )}
                  </div>
                )
              ) : (
                /* Guest Delivery Address Form */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                        Flat / House No. / Building / Street *
                      </label>
                      <AddressAutocompleteInput
                        value={guestAddressLine1}
                        onChange={(val) => {
                          setGuestAddressLine1(val);
                          if (step2Errors.addressLine1) setStep2Errors({ ...step2Errors, addressLine1: undefined });
                        }}
                        onAddressSelect={(comp) => {
                          if (comp.addressLine1) setGuestAddressLine1(comp.addressLine1);
                          if (comp.city) setGuestCity(comp.city);
                          if (comp.state) setGuestState(comp.state);
                          if (comp.pincode) setGuestPincode(comp.pincode);
                          if (comp.landmark && !guestLandmark) setGuestLandmark(comp.landmark);
                        }}
                        placeholder="e.g. 402, Lotus Heritage, 12th Main Road, Jayanagar"
                        className={`w-full bg-[#FAF8F5] border text-xs px-3 py-2 rounded-xs focus:outline-none ${
                          step2Errors.addressLine1
                            ? 'border-red-400 focus:border-red-500'
                            : 'border-[#1C1917]/20 focus:border-[#967029]'
                        }`}
                      />
                      {step2Errors.addressLine1 && (
                        <p className="text-[11px] text-red-600 mt-1">{step2Errors.addressLine1}</p>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                        Landmark / Area (Optional)
                      </label>
                      <input
                        type="text"
                        value={guestLandmark}
                        onChange={(e) => setGuestLandmark(e.target.value)}
                        placeholder="e.g. Opposite Metro Pillar 14 or Near Temple"
                        className="w-full bg-[#FAF8F5] border border-[#1C1917]/20 text-xs px-3 py-2 rounded-xs focus:outline-none focus:border-[#967029]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                        City / Town *
                      </label>
                      <input
                        type="text"
                        value={guestCity}
                        onChange={(e) => {
                          setGuestCity(e.target.value);
                          if (step2Errors.city) setStep2Errors({ ...step2Errors, city: undefined });
                        }}
                        placeholder="e.g. Bengaluru"
                        className={`w-full bg-[#FAF8F5] border text-xs px-3 py-2 rounded-xs focus:outline-none ${
                          step2Errors.city
                            ? 'border-red-400 focus:border-red-500'
                            : 'border-[#1C1917]/20 focus:border-[#967029]'
                        }`}
                      />
                      {step2Errors.city && (
                        <p className="text-[11px] text-red-600 mt-1">{step2Errors.city}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                        State *
                      </label>
                      <select
                        value={guestState}
                        onChange={(e) => setGuestState(e.target.value)}
                        className="w-full bg-[#FAF8F5] border border-[#1C1917]/20 text-xs px-3 py-2 rounded-xs focus:outline-none focus:border-[#967029]"
                      >
                        {INDIAN_STATES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                        PIN Code *
                      </label>
                      <input
                        type="text"
                        value={guestPincode}
                        onChange={(e) => {
                          setGuestPincode(e.target.value);
                          if (step2Errors.pincode) setStep2Errors({ ...step2Errors, pincode: undefined });
                        }}
                        placeholder="e.g. 560038"
                        maxLength={6}
                        className={`w-full bg-[#FAF8F5] border text-xs px-3 py-2 rounded-xs focus:outline-none ${
                          step2Errors.pincode
                            ? 'border-red-400 focus:border-red-500'
                            : 'border-[#1C1917]/20 focus:border-[#967029]'
                        }`}
                      />
                      {step2Errors.pincode && (
                        <p className="text-[11px] text-red-600 mt-1">{step2Errors.pincode}</p>
                      )}
                    </div>
                  </div>

                  {currentStep === 2 && (
                    <div className="pt-2 flex justify-between items-center">
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="text-xs text-[#78716C] hover:text-[#1C1917] cursor-pointer"
                      >
                        ← Back to Contact
                      </button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          if (validateStep2()) {
                            setCurrentStep(3);
                          }
                        }}
                        rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                      >
                        Proceed to Review & Shipping
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 3: Order Review & Notes */}
            <div className="bg-[#FAF8F5] border border-[#1C1917]/10 rounded-xs p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#1C1917]/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center ${
                      currentStep === 3
                        ? 'bg-[#1C1917] text-[#FAF8F5]'
                        : currentStep > 3
                        ? 'bg-emerald-700 text-white'
                        : 'bg-[#E7E5E4] text-[#78716C]'
                    }`}
                  >
                    {currentStep > 3 ? '✓' : '3'}
                  </span>
                  <h2 className="font-serif text-base text-[#1C1917] font-medium">
                    3. Review Bag & Delivery Foundation
                  </h2>
                </div>
              </div>

              {currentStep >= 3 && (
                <div className="space-y-4">
                  {/* Shipping & Delivery Notice */}
                  <div className="p-3 bg-[#F4EFE6] rounded-xs flex items-center gap-3 text-xs">
                    <Truck className="w-4 h-4 text-[#967029] shrink-0" />
                    <div className="text-[#57534E]">
                      <span className="font-semibold text-[#1C1917]">
                        Shipping & Delivery:
                      </span>{' '}
                      {announcementText}
                    </div>
                  </div>

                  {/* Items snapshot */}
                  <div className="divide-y divide-[#1C1917]/10 text-xs">
                    {cartItems.map((item, idx) => (
                      <div key={idx} className="py-2.5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.product.primaryImage}
                            alt={item.product.name}
                            className="w-10 h-12 object-cover rounded-xs bg-[#EFE9DC]"
                          />
                          <div>
                            <p className="font-medium text-[#1C1917]">{item.product.name}</p>
                            <p className="text-[11px] text-[#78716C]">
                              Qty: {item.quantity}{' '}
                              {item.selectedColor && `· ${item.selectedColor}`}
                            </p>
                          </div>
                        </div>
                        <span className="font-medium text-[#1C1917] tabular-nums">
                          {formatPrice(item.product.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Order Notes / Special Instructions */}
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                      Bespoke Notes / Gift Message (Optional)
                    </label>
                    <textarea
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Special delivery instructions or personal message for gift wrap..."
                      rows={2}
                      className="w-full bg-[#FAF8F5] border border-[#1C1917]/20 text-xs p-2 rounded-xs focus:outline-none focus:border-[#967029]"
                    />
                  </div>

                  {currentStep === 3 && (
                    <div className="pt-2 flex justify-between items-center">
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="text-xs text-[#78716C] hover:text-[#1C1917] cursor-pointer"
                      >
                        ← Back to Address
                      </button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setCurrentStep(4)}
                        rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                      >
                        Proceed to Payment
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 4: Payment Selection & Order Execution */}
            <div className="bg-[#FAF8F5] border border-[#1C1917]/10 rounded-xs p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#1C1917]/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center ${
                      currentStep === 4
                        ? 'bg-[#1C1917] text-[#FAF8F5]'
                        : 'bg-[#E7E5E4] text-[#78716C]'
                    }`}
                  >
                    4
                  </span>
                  <h2 className="font-serif text-base text-[#1C1917] font-medium">
                    4. Payment Selection
                  </h2>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#967029]">
                  <Lock className="w-3.5 h-3.5" />
                  <span>256-bit Secure Gateway</span>
                </div>
              </div>

              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {/* Razorpay Online Payment Option */}
                    <label
                      className={`p-4 border rounded-xs cursor-pointer block transition-all ${
                        paymentMethod === 'online'
                          ? 'border-[#967029] bg-[#F4EFE6]/60 shadow-2xs'
                          : 'border-[#1C1917]/10 hover:border-[#1C1917]/30'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="online"
                            checked={paymentMethod === 'online'}
                            onChange={() => setPaymentMethod('online')}
                            className="mt-1 accent-[#967029]"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-[#1C1917]">
                                Pay Online via Razorpay
                              </span>
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-xs">
                                Instant Verification
                              </span>
                            </div>
                            <p className="text-[11px] text-[#57534E] mt-0.5">
                              UPI (GPay, PhonePe, Paytm), Credit / Debit Cards, Netbanking & Wallets.
                            </p>
                          </div>
                        </div>
                        <CreditCard className="w-4 h-4 text-[#967029] shrink-0" />
                      </div>
                    </label>

                    {codEnabled ? (
                    <label
                      className={`p-4 border rounded-xs cursor-pointer block transition-all ${
                        paymentMethod === 'cod'
                          ? 'border-[#967029] bg-[#F4EFE6]/60 shadow-2xs'
                          : 'border-[#1C1917]/10 hover:border-[#1C1917]/30'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="cod"
                            checked={paymentMethod === 'cod'}
                            onChange={() => setPaymentMethod('cod')}
                            className="mt-1 accent-[#967029]"
                          />
                          <div>
                            <span className="font-semibold text-xs text-[#1C1917]">
                              Cash on Delivery (COD)
                            </span>
                            <p className="text-[11px] text-[#57534E] mt-0.5">
                              Pay in cash or UPI directly upon courier delivery.
                            </p>
                          </div>
                        </div>
                        <Banknote className="w-4 h-4 text-[#78716C] shrink-0" />
                      </div>
                    </label>
                    ) : (
                      <div className="p-4 border border-[#1C1917]/10 rounded-xs bg-[#F4EFE6]/50 text-xs text-[#57534E]">
                        <span className="font-semibold text-[#1C1917]">Cash on Delivery</span>
                        <p className="mt-1">COD is unavailable due to high demand.</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="text-xs text-[#78716C] hover:text-[#1C1917] cursor-pointer"
                    >
                      ← Back to Review
                    </button>
                    <Button
                      variant="primary"
                      size="md"
                      loading={submitting || verifyingPayment}
                      disabled={Boolean(validating || (validation && !validation.isValid))}
                      onClick={handlePlaceOrder}
                      className={paymentMethod === 'online' ? '!bg-[#800020] hover:!bg-[#600018]' : ''}
                      rightIcon={
                        verifyingPayment ? (
                          <RotateCw className="w-4 h-4 animate-spin" />
                        ) : paymentMethod === 'online' ? (
                          <Lock className="w-4 h-4" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )
                      }
                    >
                      {verifyingPayment
                        ? 'Verifying Signature...'
                        : submitting
                        ? 'Processing Order...'
                        : paymentMethod === 'online'
                        ? `Pay ${formatPrice(Math.max(0, subtotal - couponDiscount))} with Razorpay`
                        : `Place COD Order (${formatPrice(Math.max(0, subtotal - couponDiscount))})`}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sticky Summary Column */}
          <div className="lg:col-span-4 sticky top-24 space-y-4">
            <div className="bg-[#FAF8F5] border border-[#1C1917]/10 rounded-xs p-6 shadow-2xs space-y-4">
              <h2 className="font-serif text-base text-[#1C1917] font-medium border-b border-[#1C1917]/10 pb-3">
                Order Financial Summary
              </h2>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#1C1917]">Coupon code</label>
                <div className="flex gap-2"><input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} disabled={Boolean(couponCode)} maxLength={40} placeholder="Enter code" className="min-w-0 flex-1 border border-[#1C1917]/15 bg-white p-2 rounded-xs text-xs"/><button type="button" onClick={() => { if (couponCode) { setCouponCode(''); setCouponDiscount(0); setCouponMessage('Coupon removed.'); } else { void applyCoupon(); } }} disabled={couponBusy} className="px-3 border border-[#967029]/40 text-[#785A18] rounded-xs text-xs font-semibold disabled:opacity-50">{couponBusy ? 'Checking…' : couponCode ? 'Remove' : 'Apply'}</button></div>
                {couponMessage && <p className={`text-[11px] ${couponDiscount > 0 ? 'text-emerald-700' : 'text-[#800020]'}`}>{couponMessage}</p>}
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-[#57534E]">
                  <span>Items Subtotal ({cartItems.reduce((s, i) => s + i.quantity, 0)} pcs)</span>
                  <span className="tabular-nums">{formatPrice(subtotal)}</span>
                </div>

                <div className="flex justify-between text-[#57534E]">
                  <span>Shipping</span>
                  <span className="text-[#1C1917] font-medium">Calculated at checkout</span>
                </div>

                <div className="flex justify-between text-[#57534E]">
                  <span>GST / Taxes</span>
                  <span className="text-[#78716C]">Included</span>
                </div>

                {couponDiscount > 0 && <div className="flex justify-between text-emerald-700"><span>Coupon discount</span><span>−{formatPrice(couponDiscount)}</span></div>}
                <div className="border-t border-[#1C1917]/10 pt-3 flex justify-between items-baseline font-semibold text-[#1C1917] text-sm">
                  <span>Payable Total</span>
                  <span className="font-serif text-lg tabular-nums text-[#800020]">
                    {formatPrice(Math.max(0, subtotal - couponDiscount))}
                  </span>
                </div>
              </div>

              {/* Delivery Destination Preview */}
              {selectedAddress ? (
                <div className="border-t border-[#1C1917]/10 pt-3 text-[11px] text-[#57534E] space-y-0.5">
                  <span className="text-[10px] uppercase font-semibold text-[#78716C] block">
                    Delivering To
                  </span>
                  <p className="font-medium text-[#1C1917]">{selectedAddress.recipientName}</p>
                  <p className="truncate">
                    {selectedAddress.city}, {selectedAddress.state} — {selectedAddress.pincode}
                  </p>
                </div>
              ) : guestAddressLine1 ? (
                <div className="border-t border-[#1C1917]/10 pt-3 text-[11px] text-[#57534E] space-y-0.5">
                  <span className="text-[10px] uppercase font-semibold text-[#78716C] block">
                    Guest Delivery To
                  </span>
                  <p className="font-medium text-[#1C1917]">{guestName || 'Patron'}</p>
                  <p className="truncate">
                    {guestCity || 'City'}, {guestState} — {guestPincode}
                  </p>
                </div>
              ) : null}

              {/* Trust Badge */}
              <div className="pt-2 border-t border-[#1C1917]/10 space-y-2 text-[10px] text-[#78716C]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#967029] shrink-0" />
                  <span>Authentic Handloom Certified with Silk Mark Assurance</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-[#967029] shrink-0" />
                  <span>Razorpay PCI-DSS Level 1 Encrypted Payment Engine</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Address Modal for Authenticated Patron */}
        {addressModalOpen && (
          <AddressModal
            isOpen={addressModalOpen}
            onClose={() => setAddressModalOpen(false)}
            onSave={handleSaveAddress}
          />
        )}
      </Container>
    </div>
  );
};
