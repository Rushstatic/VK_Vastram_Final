import React from 'react';
import { X, RotateCcw, Check } from 'lucide-react';
import { ColorSwatch } from '../ui/ColorSwatch';
import { CanonicalColor } from '../../lib/colorSystem';

export interface FilterState {
  availability: 'all' | 'in-stock';
  minPrice?: number;
  maxPrice?: number;
  selectedSubCategories: string[];
  selectedFabrics: string[];
  selectedColors: string[];
  onSaleOnly: boolean;
}

interface ProductFilterSidebarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onClearAll: () => void;
  availableSubCategories: string[];
  availableFabrics: string[];
  availableColors: CanonicalColor[];
  priceBounds: { min: number; max: number };
  totalCount: number;
  className?: string;
}

export const ProductFilterSidebar: React.FC<ProductFilterSidebarProps> = ({
  filters,
  onFilterChange,
  onClearAll,
  availableSubCategories,
  availableFabrics,
  availableColors,
  priceBounds,
  totalCount,
  className = '',
}) => {
  const isMeaningless = (val?: string | null) => {
    if (!val) return true;
    const clean = val.trim().toLowerCase();
    return (
      clean === '' ||
      clean === '—' ||
      clean === '-' ||
      clean === 'null' ||
      clean === 'undefined' ||
      clean === 'n/a' ||
      clean === 'na' ||
      clean === 'unknown' ||
      clean === 'none'
    );
  };

  const cleanSubCategories = availableSubCategories.filter((s) => !isMeaningless(s));
  const cleanFabrics = availableFabrics.filter((f) => !isMeaningless(f));
  const cleanColors = availableColors.filter(
    (c) => c && c.displayName && c.canonicalName !== 'unassigned'
  );

  const hasActiveFilters =
    filters.availability !== 'all' ||
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined ||
    filters.selectedSubCategories.length > 0 ||
    filters.selectedFabrics.length > 0 ||
    filters.selectedColors.length > 0 ||
    filters.onSaleOnly;

  const toggleSubCategory = (sub: string) => {
    const next = filters.selectedSubCategories.includes(sub)
      ? filters.selectedSubCategories.filter((s) => s !== sub)
      : [...filters.selectedSubCategories, sub];
    onFilterChange({ ...filters, selectedSubCategories: next });
  };

  const toggleFabric = (fabric: string) => {
    const next = filters.selectedFabrics.includes(fabric)
      ? filters.selectedFabrics.filter((f) => f !== fabric)
      : [...filters.selectedFabrics, fabric];
    onFilterChange({ ...filters, selectedFabrics: next });
  };

  const toggleColor = (colorName: string) => {
    const next = filters.selectedColors.includes(colorName)
      ? filters.selectedColors.filter((c) => c !== colorName)
      : [...filters.selectedColors, colorName];
    onFilterChange({ ...filters, selectedColors: next });
  };

  return (
    <aside className={`w-full space-y-6 text-left ${className}`}>
      {/* Sidebar Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1C1917]/10">
        <div>
          <h3 className="font-serif text-lg font-normal text-[#1C1917]">
            Find Your Pick
          </h3>
          <p className="text-[11px] text-[#78716C]">
            {totalCount} {totalCount === 1 ? 'creation' : 'creations'} available
          </p>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-1 text-[11px] text-[#967029] hover:text-[#1C1917] transition-colors cursor-pointer font-medium"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {/* 1. Availability */}
      <div className="space-y-2.5">
        <h4 className="text-[11px] uppercase tracking-wider font-semibold text-[#1C1917]">
          Availability
        </h4>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[#57534E] cursor-pointer">
            <input
              type="radio"
              name="availability"
              checked={filters.availability === 'all'}
              onChange={() => onFilterChange({ ...filters, availability: 'all' })}
              className="accent-[#967029]"
            />
            <span>All Creations</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-[#57534E] cursor-pointer">
            <input
              type="radio"
              name="availability"
              checked={filters.availability === 'in-stock'}
              onChange={() => onFilterChange({ ...filters, availability: 'in-stock' })}
              className="accent-[#967029]"
            />
            <span>In Stock Only</span>
          </label>
        </div>
      </div>

      {/* 2. Price Filter */}
      <div className="space-y-2.5 pt-3 border-t border-[#1C1917]/10">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] uppercase tracking-wider font-semibold text-[#1C1917]">
            Price Range
          </h4>
          <span className="text-[11px] text-[#78716C] font-mono">
            ₹{filters.minPrice ?? priceBounds.min} – ₹{filters.maxPrice ?? priceBounds.max}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label className="block text-[10px] text-[#78716C] mb-0.5">Min (₹)</label>
            <input
              type="number"
              min={priceBounds.min}
              max={filters.maxPrice ?? priceBounds.max}
              value={filters.minPrice ?? ''}
              placeholder={String(priceBounds.min)}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined;
                onFilterChange({ ...filters, minPrice: val });
              }}
              className="w-full bg-[#FAF8F5] border border-[#1C1917]/20 text-xs px-2.5 py-1.5 rounded-xs focus:outline-none focus:border-[#967029]"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#78716C] mb-0.5">Max (₹)</label>
            <input
              type="number"
              min={filters.minPrice ?? priceBounds.min}
              max={priceBounds.max}
              value={filters.maxPrice ?? ''}
              placeholder={String(priceBounds.max)}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined;
                onFilterChange({ ...filters, maxPrice: val });
              }}
              className="w-full bg-[#FAF8F5] border border-[#1C1917]/20 text-xs px-2.5 py-1.5 rounded-xs focus:outline-none focus:border-[#967029]"
            />
          </div>
        </div>
      </div>

      {/* 3. Weaves / Subcategories (if available) */}
      {cleanSubCategories.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-[#1C1917]/10">
          <h4 className="text-[11px] uppercase tracking-wider font-semibold text-[#1C1917]">
            Weave / Style
          </h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {cleanSubCategories.map((sub) => {
              const checked = filters.selectedSubCategories.includes(sub);
              return (
                <label
                  key={sub}
                  className="flex items-center justify-between text-xs text-[#57534E] hover:text-[#1C1917] cursor-pointer py-0.5"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSubCategory(sub)}
                      className="accent-[#967029] rounded-xs"
                    />
                    <span>{sub}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Fabric */}
      {cleanFabrics.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-[#1C1917]/10">
          <h4 className="text-[11px] uppercase tracking-wider font-semibold text-[#1C1917]">
            Fabric
          </h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {cleanFabrics.map((fabric) => {
              const checked = filters.selectedFabrics.includes(fabric);
              return (
                <label
                  key={fabric}
                  className="flex items-center justify-between text-xs text-[#57534E] hover:text-[#1C1917] cursor-pointer py-0.5"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFabric(fabric)}
                      className="accent-[#967029] rounded-xs"
                    />
                    <span>{fabric}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Color Swatches */}
      {cleanColors.length > 0 && (
        <div className="space-y-2.5 pt-3 border-t border-[#1C1917]/10">
          <h4 className="text-[11px] uppercase tracking-wider font-semibold text-[#1C1917]">
            Colour Palette
          </h4>
          <div className="flex flex-wrap gap-2.5 pt-1">
            {cleanColors.map((col) => {
              const checked = filters.selectedColors.includes(col.canonicalName);
              return (
                <div key={col.canonicalName} className="flex items-center">
                  <ColorSwatch
                    colorName={col.displayName}
                    size="md"
                    selected={checked}
                    onClick={() => toggleColor(col.canonicalName)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. On Sale Toggle */}
      <div className="pt-3 border-t border-[#1C1917]/10">
        <label className="flex items-center gap-2.5 text-xs text-[#57534E] hover:text-[#1C1917] cursor-pointer">
          <input
            type="checkbox"
            checked={filters.onSaleOnly}
            onChange={(e) => onFilterChange({ ...filters, onSaleOnly: e.target.checked })}
            className="accent-[#78281F] rounded-xs"
          />
          <span className="font-medium text-[#78281F]">Sale Items Only</span>
        </label>
      </div>
    </aside>
  );
};
