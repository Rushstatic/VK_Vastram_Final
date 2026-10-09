import React from 'react';
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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1C1917]/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Dialog */}
      <div className="relative w-full max-w-lg bg-[#FAF8F5] rounded-t-xl sm:rounded-sm shadow-2xl border border-[#1C1917]/10 z-10 flex flex-col max-h-[85vh] overflow-hidden">
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
        <div className="p-6 overflow-y-auto flex-1">
          <ProductFilterSidebar
            filters={filters}
            onFilterChange={onFilterChange}
            onClearAll={onClearAll}
            availableSubCategories={availableSubCategories}
            availableFabrics={availableFabrics}
            availableColors={availableColors}
            priceBounds={priceBounds}
            totalCount={totalCount}
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
    </div>
  );
};
