import React from 'react';
import { X, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { CartItem } from '../../types';
import { formatPrice } from '../ui/PriceDisplay';
import { Button } from '../ui/Button';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { getCartItemImage } from '../../lib/cartVariantImage';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number, cartItemId?: string) => void;
  onRemoveItem: (productId: string, cartItemId?: string) => void;
  onCheckout: () => void;
  onViewFullCart?: () => void;
  onNavigateToProduct?: (slug: string) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  onViewFullCart,
  onNavigateToProduct,
}) => {
  const { settings } = useSiteSettings();
  const announcementText = settings?.announcementBarText || 'Shipping charges calculated at checkout.';
  const exchangeWindow = settings?.exchangeWindowDays || 7;

  const [isClosing, setIsClosing] = React.useState(false);

  const handleSmoothClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 320);
  };

  // Lock body scroll gracefully while drawer is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  if (!isOpen && !isClosing) return null;

  const subtotal = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const totalItemsCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-[#1C1917]/45 transition-all duration-300 ease-out ${
          isClosing ? 'opacity-0 backdrop-blur-none pointer-events-none' : 'opacity-100 backdrop-blur-[3px]'
        }`}
        onClick={handleSmoothClose}
      />

      <div className="fixed inset-y-0 right-0 w-screen max-w-md overflow-hidden flex pointer-events-none">
        <div
          className={`w-screen max-w-md vk-glass-surface rounded-l-2xl overflow-hidden flex flex-col border-l pointer-events-auto transform transition-transform duration-320 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isClosing ? 'translate-x-full' : 'translate-x-0'
          }`}
          style={{
            animation: isClosing ? 'none' : 'cartSlideIn 320ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#1C1917]/10 bg-[#FAF8F5]/65 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#1C1917]" />
              <h3 className="font-serif text-xl font-normal text-[#1C1917]">
                Shopping Bag
              </h3>
              <span className="text-xs text-[#78716C] tabular-nums">
                ({totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'})
              </span>
            </div>
            <button
              type="button"
              onClick={handleSmoothClose}
              aria-label="Close cart"
              className="p-1.5 text-[#57534E] hover:text-[#1C1917] hover:bg-[#F4EFE6] rounded-xs transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-12 h-12 rounded-full bg-[#F4EFE6] flex items-center justify-center text-[#78716C] mb-4">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <h4 className="font-serif text-lg text-[#1C1917] mb-1 font-normal">
                  Your shopping bag is empty
                </h4>
                <p className="text-xs text-[#78716C] max-w-xs mb-6 leading-relaxed">
                  Discover our classical silk sarees, hand-block bedsheets, and artisanal textiles.
                </p>
                <Button variant="primary" size="sm" onClick={onClose}>
                  Explore Catalog
                </Button>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id || `${item.product.id}-${item.selectedColor || 'std'}-${item.selectedSize || 'std'}`}
                  className="flex gap-4 pb-5 border-b border-[#1C1917]/10 last:border-b-0"
                >
                  {getCartItemImage(item) ? (
                    <img
                      src={getCartItemImage(item)}
                      alt={`${item.product.name}${item.selectedColor ? ` — ${item.selectedColor}` : ''}`}
                      onClick={() => {
                        if (onNavigateToProduct) {
                          onNavigateToProduct(item.product.slug);
                          onClose();
                        }
                      }}
                      className="w-20 h-24 object-cover rounded-xs bg-[#F4EFE6] shrink-0 border border-[#1C1917]/5 cursor-pointer"
                    />
                  ) : (
                    <div className="w-20 h-24 flex items-center justify-center rounded-xs bg-[#F4EFE6] shrink-0 border border-[#1C1917]/5 text-[#967029]" aria-label="No image available for this variant">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          onClick={() => {
                            if (onNavigateToProduct) {
                              onNavigateToProduct(item.product.slug);
                              onClose();
                            }
                          }}
                          className="font-serif text-sm font-normal text-[#1C1917] line-clamp-2 leading-snug cursor-pointer hover:text-[#967029]"
                        >
                          {item.product.name}
                        </h4>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.product.id, item.id)}
                          aria-label={`Remove ${item.product.name}`}
                          className="text-[#78716C] hover:text-[#78281F] transition-colors p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="text-[11px] text-[#78716C] mt-1 space-y-0.5">
                        {item.selectedColor && <div>Color: {item.selectedColor}</div>}
                        {item.selectedSize && <div>Size: {item.selectedSize}</div>}
                        {item.includeFallPico && <div className="text-[#78281F]">Fall & Pico finishing</div>}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      {/* Quantity Stepper */}
                      <div className="flex items-center border border-[#1C1917]/20 rounded-xs bg-[#FAF8F5]">
                        <button
                          type="button"
                          onClick={() => {
                            const cur = Number(item.quantity) || 1;
                            onUpdateQuantity(item.product.id, Math.max(0, cur - 1), item.id);
                          }}
                          className="px-2.5 py-1 text-xs text-[#1C1917] hover:bg-[#F4EFE6] cursor-pointer"
                        >
                          -
                        </button>
                        <span className="px-2.5 py-1 text-xs font-semibold tabular-nums min-w-[24px] text-center">
                          {Number(item.quantity) || 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const cur = Number(item.quantity) || 1;
                            const max = item.stockAvailable || 99;
                            onUpdateQuantity(item.product.id, Math.min(max, cur + 1), item.id);
                          }}
                          className="px-2.5 py-1 text-xs text-[#1C1917] hover:bg-[#F4EFE6] cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      <span className="font-semibold text-sm tabular-nums text-[#1C1917]">
                        {formatPrice((item.product.price + (item.includeFallPico ? Math.max(0, Number(settings?.fallPicoPrice) || 0) : 0)) * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Subtotal & Checkout CTA */}
          {items.length > 0 && (
            <div className="p-6 border-t border-[#1C1917]/10 bg-[#FAF8F5]/78 backdrop-blur-xl space-y-3">
              <div className="space-y-1.5 text-xs text-[#57534E]">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-serif text-[#1C1917]">Subtotal</span>
                  <span className="font-semibold text-[#1C1917] text-base tabular-nums">
                    {formatPrice(subtotal)}
                  </span>
                </div>
                <p className="text-[11px] text-[#78716C]">
                  {announcementText}
                </p>
              </div>

              <div className="space-y-2">
                <Button
                  variant="primary"
                  fullWidth
                  size="md"
                  onClick={onCheckout}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Proceed to Checkout
                </Button>

                {onViewFullCart && (
                  <Button
                    variant="secondary"
                    fullWidth
                    size="sm"
                    onClick={() => {
                      onClose();
                      onViewFullCart();
                    }}
                  >
                    View Detailed Bag
                  </Button>
                )}
              </div>

              <p className="text-[10px] text-center text-[#78716C]">
                Secure Checkout · {exchangeWindow}-Day Hassle-Free Exchange
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
