import React from 'react';
import { ShoppingBag, ArrowRight, ArrowLeft, Trash2, ShieldCheck, Truck, RefreshCw } from 'lucide-react';
import { CartItem, PageView } from '../../types';
import { formatPrice } from '../ui/PriceDisplay';
import { Button } from '../ui/Button';
import { Container } from '../ui/Container';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { calculateShippingAmount } from '../../lib/shipping';
import { INDIAN_STATES } from '../../lib/indianStates';
import { getCartItemImage } from '../../lib/cartVariantImage';

interface CartPageProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number, cartItemId?: string) => void;
  onRemoveItem: (productId: string, cartItemId?: string) => void;
  onNavigate: (page: PageView) => void;
  onCheckout: () => void;
}

export const CartPage: React.FC<CartPageProps> = ({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onNavigate,
  onCheckout,
}) => {
  const { settings } = useSiteSettings();
  const [deliveryState, setDeliveryState] = React.useState(() => { try { return localStorage.getItem('vk_delivery_state') || 'Maharashtra'; } catch { return 'Maharashtra'; } });
  const fallPicoTotal = items.reduce((sum, item) => sum + (item.includeFallPico ? Math.max(0, Number(settings?.fallPicoPrice) || 0) * item.quantity : 0), 0);
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0) + fallPicoTotal;

  const announcementText = settings?.announcementBarText || 'Shipping charges calculated at checkout.';
  const exchangeWindow = settings?.exchangeWindowDays || 7;
  const shippingEstimate = settings ? calculateShippingAmount(subtotal, deliveryState, settings) : 0;
  const freeShippingGap = Math.max(0, Number(settings?.freeShippingThreshold || 0) - subtotal);

  if (items.length === 0) {
    return (
      <div className="py-20 bg-[#FAF8F5] min-h-[70vh] flex items-center justify-center">
        <Container size="narrow">
          <div className="text-center space-y-4 max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#F4EFE6] text-[#967029] flex items-center justify-center">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl text-[#1C1917] font-normal">
              Your Bag is Waiting
            </h1>
            <p className="text-xs text-[#57534E] leading-relaxed">
              Explore our curated handloom drapes and artisanal cotton bedsheets to curate your living spaces.
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

  return (
    <div className="py-12 bg-[#FAF8F5] min-h-[85vh]">
      <Container>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1C1917]/10 pb-6 mb-8">
          <div>
            <h1 className="font-serif text-3xl text-[#1C1917] font-normal">
              Shopping Bag
            </h1>
            <p className="text-xs text-[#57534E] mt-0.5">
              {items.reduce((acc, i) => acc + i.quantity, 0)} {items.length === 1 ? 'creation' : 'creations'} selected
            </p>
          </div>

          <button
            onClick={() => onNavigate({ type: 'collection', category: 'sarees' })}
            className="inline-flex items-center gap-1.5 text-xs text-[#78716C] hover:text-[#1C1917] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Continue Shopping</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Items List */}
          <div className="lg:col-span-8 bg-[#FAF8F5] border border-[#1C1917]/10 rounded-xs overflow-hidden shadow-2xs divide-y divide-[#1C1917]/10">
            {items.map((item) => (
              <div key={item.id || `${item.product.id}-${item.selectedColor || 'std'}-${item.selectedSize || 'std'}`} className="p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between">
                {/* Product details */}
                <div className="flex items-center gap-4 min-w-0">
                  {getCartItemImage(item) ? (
                    <img
                      src={getCartItemImage(item)}
                      alt={`${item.product.name}${item.selectedColor ? ` — ${item.selectedColor}` : ''}`}
                      className="w-20 h-24 sm:w-24 sm:h-28 object-cover rounded-xs bg-[#EFE9DC] shrink-0 border border-[#1C1917]/5"
                    />
                  ) : (
                    <div className="w-20 h-24 sm:w-24 sm:h-28 flex items-center justify-center rounded-xs bg-[#EFE9DC] shrink-0 border border-[#1C1917]/5 text-[#967029]" aria-label="No image available for this variant">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                  )}
                  <div className="space-y-1 min-w-0">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-[#967029]">
                      {item.product.categoryLabel}
                    </span>
                    <h3
                      onClick={() => onNavigate({ type: 'product', slug: item.product.slug })}
                      className="font-serif text-base text-[#1C1917] font-medium line-clamp-1 hover:text-[#967029] cursor-pointer transition-colors"
                    >
                      {item.product.name}
                    </h3>

                    {item.includeFallPico && <p className="text-[11px] text-[#78281F]">Fall & Pico finishing included</p>}
                    {(item.selectedColor || item.selectedSize) && (
                      <p className="text-[11px] text-[#78716C]">
                        {item.selectedColor && <span>Color: {item.selectedColor}</span>}
                        {item.selectedColor && item.selectedSize && <span> · </span>}
                        {item.selectedSize && <span>Size: {item.selectedSize}</span>}
                      </p>
                    )}

                    <p className="font-semibold text-xs text-[#1C1917] tabular-nums pt-1">
                      {formatPrice(item.product.price + (item.includeFallPico ? Math.max(0, Number(settings?.fallPicoPrice) || 0) : 0))} each
                    </p>
                  </div>
                </div>

                {/* Quantity and Line Total */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-4">
                  <div className="flex items-center border border-[#1C1917]/20 rounded-xs bg-[#F4EFE6]">
                    <button
                      onClick={() => {
                        const cur = Number(item.quantity) || 1;
                        onUpdateQuantity(item.product.id, Math.max(0, cur - 1), item.id);
                      }}
                      className="w-8 h-8 flex items-center justify-center text-[#1C1917] hover:bg-[#EFE9DC] cursor-pointer transition-colors text-xs"
                      aria-label="Decrease quantity"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-xs font-semibold text-[#1C1917] tabular-nums">
                      {Number(item.quantity) || 1}
                    </span>
                    <button
                      onClick={() => {
                        const cur = Number(item.quantity) || 1;
                        const max = item.stockAvailable || 99;
                        onUpdateQuantity(item.product.id, Math.min(max, cur + 1), item.id);
                      }}
                      className="w-8 h-8 flex items-center justify-center text-[#1C1917] hover:bg-[#EFE9DC] cursor-pointer transition-colors text-xs"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <p className="font-serif font-medium text-sm text-[#1C1917] tabular-nums">
                      {formatPrice((item.product.price + (item.includeFallPico ? Math.max(0, Number(settings?.fallPicoPrice) || 0) : 0)) * item.quantity)}
                    </p>
                    <button
                      onClick={() => onRemoveItem(item.product.id, item.id)}
                      className="p-1.5 text-[#78716C] hover:text-red-700 rounded-xs cursor-pointer transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary Box */}
          <div className="lg:col-span-4 bg-[#FAF8F5] border border-[#1C1917]/10 rounded-xs p-6 shadow-2xs space-y-6 sticky top-24">
            <h2 className="font-serif text-lg text-[#1C1917] font-medium border-b border-[#1C1917]/10 pb-3">
              Order Summary
            </h2>

            <div className="space-y-3 text-xs text-[#57534E]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-[#1C1917] tabular-nums text-sm">
                  {formatPrice(subtotal)}
                </span>
              </div>

              <div className="space-y-2 text-[11px] text-[#78716C] pt-1">
                <label className="flex items-center justify-between gap-3"><span>Delivery state</span><select value={deliveryState} onChange={(event) => { const next = event.target.value; setDeliveryState(next); try { localStorage.setItem('vk_delivery_state', next); } catch { /* ignore */ } }} className="max-w-[190px] border border-[#1C1917]/15 bg-white p-2 rounded-xs text-[#1C1917]">{INDIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
                <div className="flex justify-between"><span>Estimated Shipping</span><span className="text-right font-medium text-[#1C1917]">{shippingEstimate === 0 && Number(settings?.freeShippingThreshold || 0) > 0 && subtotal >= Number(settings?.freeShippingThreshold || 0) ? 'FREE' : formatPrice(shippingEstimate)}</span></div>
              </div>

              <div className="border-t border-[#1C1917]/10 pt-3 flex justify-between items-baseline text-sm font-semibold text-[#1C1917]">
                <span>Estimated Total</span>
                <span className="font-serif text-lg text-[#78281F] tabular-nums">{formatPrice(subtotal + shippingEstimate)}</span>
              </div>
              <div className="flex justify-between items-baseline text-[11px] text-[#78716C]">
                <span>Bag Subtotal (before shipping)</span>
                <span className="font-serif text-lg text-[#1C1917] tabular-nums">
                  {formatPrice(subtotal)}
                </span>
              </div>
              <p className="text-[10px] text-[#78716C] leading-relaxed">
                {announcementText}
              </p>
            </div>

            <Button
              variant="primary"
              fullWidth
              size="lg"
              onClick={onCheckout}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Proceed to Checkout
            </Button>

            {/* Trust Assurances */}
            <div className="space-y-2 pt-4 border-t border-[#1C1917]/10 text-[11px] text-[#78716C]">
              <div className="flex items-center gap-2">
                <Truck className="w-3.5 h-3.5 text-[#967029]" />
                <span>Door-to-door tracking provided with every shipment</span>
              </div>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-[#967029]" />
                <span>{exchangeWindow}-day easy exchange policy</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[#967029]" />
                <span>100% Authentic Handloom Craftsmanship</span>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
};
