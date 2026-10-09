import React, { useState, useMemo } from 'react';
import { X, Search as SearchIcon } from 'lucide-react';
import { Product } from '../../types';
import { PriceDisplay } from '../ui/PriceDisplay';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSelectProduct: (slug: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  products,
  onSelectProduct,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  const handleSmoothClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
      setSearchTerm('');
    }, 280);
  };

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.fabric.toLowerCase().includes(term) ||
        p.weave.toLowerCase().includes(term) ||
        p.origin.toLowerCase().includes(term) ||
        p.categoryLabel.toLowerCase().includes(term) ||
        (p.subCategory && p.subCategory.toLowerCase().includes(term))
    );
  }, [searchTerm, products]);

  if (!isOpen && !isClosing) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className={`fixed inset-0 bg-[#1C1917]/65 transition-all duration-280 ease-out ${
          isClosing ? 'opacity-0 backdrop-blur-none pointer-events-none' : 'opacity-100 backdrop-blur-[3px]'
        }`}
        onClick={handleSmoothClose}
      />

      <div className="relative min-h-screen px-4 pt-16 pb-12 sm:px-6 flex justify-center items-start">
        <div
          className={`relative w-full max-w-2xl bg-[#FAF8F5] shadow-2xl rounded-xs border border-[#1C1917]/10 z-10 overflow-hidden transform transition-all duration-280 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isClosing
              ? 'opacity-0 scale-95 -translate-y-2'
              : 'opacity-100 scale-100 translate-y-0'
          }`}
          style={{
            animation: isClosing ? 'none' : 'searchModalIn 280ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          {/* Search Header Input */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1C1917]/10">
            <SearchIcon className="w-5 h-5 text-[#967029] shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by weave, silk grade, fabric or motif (e.g., Banarasi, 400 TC, Paithani)..."
              className="w-full bg-transparent text-base text-[#1C1917] placeholder-[#78716C] focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSmoothClose}
              className="p-1.5 text-[#78716C] hover:text-[#1C1917] hover:bg-[#F4EFE6] rounded-xs transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Suggestions when empty */}
          {!searchTerm.trim() && (
            <div className="p-6">
              <p className="text-[10px] uppercase tracking-wider text-[#967029] font-semibold mb-3">
                Suggested Searches
              </p>
              <div className="flex flex-wrap gap-2">
                {['Banarasi Katan Silk', 'Kanjivaram Silk', 'Paithani', 'Chanderi', '400 TC Bedsheet', 'Bagh Print'].map(
                  (suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setSearchTerm(suggestion)}
                      className="text-xs text-[#57534E] hover:text-[#1C1917] bg-[#F4EFE6] hover:bg-[#EFE9DC] px-3 py-1.5 rounded-xs transition-colors cursor-pointer"
                    >
                      {suggestion}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* Search Results */}
          {searchTerm.trim() && (
            <div className="p-4 max-h-[60vh] overflow-y-auto divide-y divide-[#1C1917]/5">
              {filteredProducts.length === 0 ? (
                <div className="py-12 text-center text-[#78716C]">
                  <p className="font-serif text-lg text-[#1C1917] mb-1">
                    No matching textiles found
                  </p>
                  <p className="text-xs">
                    Try searching for &quot;Silk&quot;, &quot;Cotton&quot;, &quot;Banarasi&quot;, &quot;Paithani&quot;, or &quot;Bedsheet&quot;.
                  </p>
                </div>
              ) : (
                filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => {
                      onSelectProduct(product.slug);
                      onClose();
                    }}
                    className="py-3 px-3 flex items-center gap-4 hover:bg-[#F4EFE6]/70 rounded-xs cursor-pointer transition-colors"
                  >
                    <img
                      src={product.primaryImage}
                      alt={product.name}
                      className="w-14 h-18 object-cover rounded-xs bg-[#F4EFE6] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-[#967029] font-medium">
                        {product.categoryLabel} · {product.origin.split(',')[0]}
                      </div>
                      <h4 className="font-serif text-sm text-[#1C1917] truncate font-medium">
                        {product.name}
                      </h4>
                      <p className="text-xs text-[#78716C] truncate mt-0.5">
                        {product.fabric} · {product.weave}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <PriceDisplay price={product.price} mrp={product.mrp} size="sm" />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
