import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCcw } from 'lucide-react';
import { ProductFilterSidebar, FilterState } from './ProductFilterSidebar';
import { CanonicalColor } from '../../lib/colorSystem';
import { Button } from '../ui/Button';

interface ProductFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onClearAll: () => void;
  availableSubCategories: string[];
  availableFabrics: string[];
  availableColors: CanonicalColor[];
  priceBounds: { min: number; max: number };
  totalCount: number;
}

export const ProductFilterDrawer: React.FC<ProductFilterDrawerProps> = ({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  onClearAll,
  availableSubCategories,
  availableFabrics,
  availableColors,
  priceBounds,
  totalCount,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal((
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4" role="presentation">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close filters"
        className="fixed inset-0 bg-[#1C1917]/60 backdrop-blur-sm transition-opacity cursor-default"
        onClick={onClose}
      />

      {/* Drawer Dialog */}
      <div role="dialog" aria-modal="true" aria-label="Product filters" className="relative z-10 flex h-[min(92dvh,850px)] max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-none bg-[#FAF8F5] shadow-2xl sm:rounded-sm sm:border sm:border-[#1C1917]/10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1C1917]/10 shrink-0">
          <div>
            <h3 className="font-serif text-lg text-[#1C1917] font-normal">
              Filters
            </h3>
            <span className="text-xs text-[#78716C]">
              {totalCount} creations match
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="w-8 h-8 rounded-full border border-[#1C1917]/15 flex items-center justify-center text-[#1C1917] hover:bg-[#F4EFE6] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Filter Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 [scrollbar-width:thin] [scrollbar-color:#B88E3E_transparent] sm:px-6">
          <ProductFilterSidebar
            filters={filters}
            onFilterChange={onFilterChange}
            onClearAll={onClearAll}
            availableSubCategories={availableSubCategories}
            availableFabrics={availableFabrics}
            availableColors={availableColors}
            priceBounds={priceBounds}
            totalCount={totalCount}
            disableSectionScroll
            className="filter-drawer-sidebar"
          />
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#FAF8F5] border-t border-[#1C1917]/10 flex items-center gap-3 shrink-0">
          <Button
            variant="ghost"
            size="md"
            onClick={onClearAll}
            className="flex-1"
          >
            Reset
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={onClose}
            className="flex-2"
          >
            Apply Filters ({totalCount})
          </Button>
        </div>
      </div>
    </div>), document.body);
};
