import React, { useState, useMemo, useEffect } from 'react';
import { Container } from '../ui/Container';
import { ProductGrid } from '../catalog/ProductGrid';
import { Product, ProductCategory, PageView, CollectionCategory } from '../../types';
import { PRODUCTS, CATEGORIES } from '../../data/catalog';
import { SlidersHorizontal, Filter, X, RotateCcw } from 'lucide-react';
import { ProductFilterSidebar, FilterState } from '../catalog/ProductFilterSidebar';
import { ProductFilterDrawer } from '../catalog/ProductFilterDrawer';
import { getAvailableColorsFromProducts, resolveCanonicalColor } from '../../lib/colorSystem';
import { getDiscoveryOrderedProducts } from '../../lib/discoveryOrder';
import { Button } from '../ui/Button';

interface CollectionPageProps {
  category: ProductCategory;
  subCategoryFilter?: string;
  initialPriceMin?: number;
  initialPriceMax?: number;
  onNavigate: (page: PageView) => void;
  wishlistIds: string[];
  onToggleWishlist: (product: Product) => void;
  onQuickView: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  products?: Product[];
  categories?: CollectionCategory[];
}

export const CollectionPage: React.FC<CollectionPageProps> = ({
  category,
  subCategoryFilter,
  initialPriceMin,
  initialPriceMax,
  onNavigate,
  wishlistIds,
  onToggleWishlist,
  onQuickView,
  onAddToCart,
  products = PRODUCTS,
  categories = CATEGORIES,
}) => {
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [selectedSort, setSelectedSort] = useState<'discovery' | 'price-asc' | 'price-desc' | 'newest'>('discovery');

  // Filter State
  const [filters, setFilters] = useState<FilterState>({
    availability: 'all',
    minPrice: initialPriceMin,
    maxPrice: initialPriceMax,
    selectedSubCategories: subCategoryFilter && subCategoryFilter !== 'all' ? [subCategoryFilter] : [],
    selectedFabrics: [],
    selectedColors: [],
    onSaleOnly: false,
  });

  // Apply optional homepage price shortcuts when a collection is opened.
  useEffect(() => {
    setFilters((prev) => ({ ...prev, minPrice: initialPriceMin, maxPrice: initialPriceMax }));
  }, [initialPriceMin, initialPriceMax]);

  // Sync subCategoryFilter prop if it changes
  useEffect(() => {
    if (subCategoryFilter && subCategoryFilter !== 'all') {
      setFilters((prev) => ({
        ...prev,
        selectedSubCategories: [subCategoryFilter],
      }));
    }
  }, [subCategoryFilter]);

  const categoryMeta = categories.find((c) => c.category === category) || {
    title: category === 'all' ? 'All Handloom Creations' : 'Textile Collection',
    subtitle: 'Authentic Indian handlooms, ceremonial silks, and curated home goods.',
  };

  // Base product pool for this category
  const categoryPool = useMemo(() => {
    return products.filter((p) => category === 'all' || p.category === category);
  }, [category, products]);

  // Meaningless / placeholder filter suppression
  const isMeaninglessValue = (val?: string | null): boolean => {
    if (!val) return true;
    const clean = val.trim().toLowerCase();
    return clean === '' || clean === '—' || clean === '-' || clean === 'null' || clean === 'undefined' || clean === 'n/a' || clean === 'na' || clean === 'unknown' || clean === 'none';
  };

  // Derived filter options based on real products in this category
  const availableSubCategories = useMemo(() => {
    const subs = new Set<string>();
    categoryPool.forEach((p) => {
      if (p.subCategory && !isMeaninglessValue(p.subCategory)) {
        subs.add(p.subCategory.trim());
      }
    });
    return Array.from(subs);
  }, [categoryPool]);

  const availableFabrics = useMemo(() => {
    const fabrics = new Set<string>();
    categoryPool.forEach((p) => {
      if (p.fabric && !isMeaninglessValue(p.fabric)) {
        // extract primary fabric word/type
        const cleanFabric = p.fabric.split('(')[0].trim();
        if (!isMeaninglessValue(cleanFabric)) {
          fabrics.add(cleanFabric);
        }
      }
    });
    return Array.from(fabrics).slice(0, 8);
  }, [categoryPool]);

  const availableColors = useMemo(() => {
    return getAvailableColorsFromProducts(categoryPool);
  }, [categoryPool]);

  const priceBounds = useMemo(() => {
    if (categoryPool.length === 0) return { min: 1000, max: 50000 };
    const prices = categoryPool.map((p) => p.price);
    return {
      min: Math.floor(Math.min(...prices) / 100) * 100,
      max: Math.ceil(Math.max(...prices) / 100) * 100,
    };
  }, [categoryPool]);

  // Filter and Sort Engine
  const filteredProducts = useMemo(() => {
    let list = [...categoryPool];

    // 1. Availability filter
    if (filters.availability === 'in-stock') {
      list = list.filter((p) => p.inStock !== false && (p.stockQuantity === undefined || p.stockQuantity > 0));
    }

    // 2. Price filter
    if (filters.minPrice !== undefined) {
      list = list.filter((p) => p.price >= (filters.minPrice as number));
    }
    if (filters.maxPrice !== undefined) {
      list = list.filter((p) => p.price <= (filters.maxPrice as number));
    }

    // 3. Subcategories / Weaves
    if (filters.selectedSubCategories.length > 0) {
      list = list.filter((p) => p.subCategory && filters.selectedSubCategories.includes(p.subCategory));
    }

    // 4. Fabrics
    if (filters.selectedFabrics.length > 0) {
      list = list.filter((p) =>
        filters.selectedFabrics.some((f) => p.fabric.toLowerCase().includes(f.toLowerCase()))
      );
    }

    // 5. Colors
    if (filters.selectedColors.length > 0) {
      list = list.filter((p) => {
        if (!p.colors || p.colors.length === 0) return false;
        return p.colors.some((c) => {
          const canonical = resolveCanonicalColor(c);
          return (
            canonical &&
            canonical.canonicalName !== 'unassigned' &&
            filters.selectedColors.includes(canonical.canonicalName)
          );
        });
      });
    }

    // 6. On Sale
    if (filters.onSaleOnly) {
      list = list.filter((p) => p.onSale);
    }

    // Sorting Engine
    if (selectedSort === 'price-asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (selectedSort === 'price-desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (selectedSort === 'newest') {
      list.sort((a, b) => (b.newArrival ? 1 : 0) - (a.newArrival ? 1 : 0));
    } else {
      // Default: Controlled Discovery Ordering (session-aware deterministic shuffle)
      list = getDiscoveryOrderedProducts(list);
    }

    return list;
  }, [categoryPool, filters, selectedSort]);

  const handleClearAllFilters = () => {
    setFilters({
      availability: 'all',
      minPrice: undefined,
      maxPrice: undefined,
      selectedSubCategories: [],
      selectedFabrics: [],
      selectedColors: [],
      onSaleOnly: false,
    });
  };

  const removeSubCategory = (sub: string) => {
    setFilters((prev) => ({
      ...prev,
      selectedSubCategories: prev.selectedSubCategories.filter((s) => s !== sub),
    }));
  };

  const removeFabric = (fab: string) => {
    setFilters((prev) => ({
      ...prev,
      selectedFabrics: prev.selectedFabrics.filter((f) => f !== fab),
    }));
  };

  const removeColor = (col: string) => {
    setFilters((prev) => ({
      ...prev,
      selectedColors: prev.selectedColors.filter((c) => c !== col),
    }));
  };

  const activeFilterCount =
    (filters.availability !== 'all' ? 1 : 0) +
    (filters.minPrice !== undefined || filters.maxPrice !== undefined ? 1 : 0) +
    filters.selectedSubCategories.length +
    filters.selectedFabrics.length +
    filters.selectedColors.length +
    (filters.onSaleOnly ? 1 : 0);

  return (
    <div className="bg-[#FAF8F5] py-8 sm:py-12">
      <Container>
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#78716C] mb-8">
          <button
            onClick={() => onNavigate({ type: 'home' })}
            className="hover:text-[#1C1917] transition-colors cursor-pointer"
          >
            Home
          </button>
          <span>/</span>
          <span className="text-[#1C1917] font-medium">{categoryMeta.title}</span>
        </nav>

        {/* Collection Header */}
        <div className="border-b border-[#1C1917]/10 pb-8 mb-8">
          <span className="text-[11px] uppercase tracking-[0.2em] text-[#967029] font-medium block mb-2">
            Curated Weaves
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#1C1917] font-normal leading-tight">
            {categoryMeta.title}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[#57534E] max-w-2xl leading-relaxed">
            {categoryMeta.subtitle}
          </p>
        </div>

        {/* Filter & Sort Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-[#1C1917]/10">
          {/* Mobile Filter Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen(true)}
              className="lg:hidden inline-flex items-center gap-2 bg-[#FAF8F5] border border-[#1C1917]/20 px-3.5 py-2 rounded-xs text-xs font-medium text-[#1C1917] hover:border-[#1C1917] cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5 text-[#967029]" />
              <span>Filters {activeFilterCount > 0 && `(${activeFilterCount})`}</span>
            </button>

            {/* Quick SubCategory Pills (Desktop) */}
            <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto">
              <button
                onClick={() => setFilters((prev) => ({ ...prev, selectedSubCategories: [] }))}
                className={`px-3 py-1.5 text-xs rounded-xs transition-colors whitespace-nowrap cursor-pointer ${
                  filters.selectedSubCategories.length === 0
                    ? 'bg-[#1C1917] text-[#FAF8F5] font-medium'
                    : 'bg-[#F4EFE6] text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                All Weaves ({categoryPool.length})
              </button>
              {availableSubCategories.slice(0, 5).map((sub) => {
                const isSelected = filters.selectedSubCategories.includes(sub);
                return (
                  <button
                    key={sub}
                    onClick={() => {
                      setFilters((prev) => ({
                        ...prev,
                        selectedSubCategories: isSelected
                          ? prev.selectedSubCategories.filter((s) => s !== sub)
                          : [...prev.selectedSubCategories, sub],
                      }));
                    }}
                    className={`px-3 py-1.5 text-xs rounded-xs transition-colors whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? 'bg-[#1C1917] text-[#FAF8F5] font-medium'
                        : 'bg-[#F4EFE6] text-[#57534E] hover:text-[#1C1917]'
                    }`}
                  >
                    {sub}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sort Dropdown & Count */}
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-xs text-[#78716C] font-serif tabular-nums hidden sm:inline">
              Showing {filteredProducts.length} {filteredProducts.length === 1 ? 'creation' : 'creations'}
            </span>

            <div className="flex items-center gap-1.5 bg-[#FAF8F5] border border-[#1C1917]/20 px-3 py-1.5 rounded-xs text-xs text-[#1C1917]">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#78716C]" />
              <select
                value={selectedSort}
                onChange={(e) => setSelectedSort(e.target.value as any)}
                className="bg-transparent focus:outline-none cursor-pointer text-xs"
                aria-label="Sort products"
              >
                <option value="discovery">Curated Discovery</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="newest">Newest Arrivals</option>
              </select>
            </div>
          </div>
        </div>

        {/* Active Filter Chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6 text-xs">
            <span className="text-[#78716C] font-medium text-[11px] uppercase tracking-wider">
              Active:
            </span>

            {filters.availability === 'in-stock' && (
              <span className="inline-flex items-center gap-1 bg-[#1C1917] text-[#FAF8F5] px-2.5 py-1 rounded-xs text-[11px]">
                In Stock Only
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, availability: 'all' })}
                  className="hover:text-red-300 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filters.selectedSubCategories.map((sub) => (
              <span
                key={sub}
                className="inline-flex items-center gap-1 bg-[#F4EFE6] text-[#1C1917] border border-[#1C1917]/15 px-2.5 py-1 rounded-xs text-[11px]"
              >
                {sub}
                <button
                  type="button"
                  onClick={() => removeSubCategory(sub)}
                  className="hover:text-red-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {filters.selectedFabrics.map((fab) => (
              <span
                key={fab}
                className="inline-flex items-center gap-1 bg-[#F4EFE6] text-[#1C1917] border border-[#1C1917]/15 px-2.5 py-1 rounded-xs text-[11px]"
              >
                {fab}
                <button
                  type="button"
                  onClick={() => removeFabric(fab)}
                  className="hover:text-red-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {filters.selectedColors.map((colKey) => {
              const canonical = resolveCanonicalColor(colKey);
              return (
                <span
                  key={colKey}
                  className="inline-flex items-center gap-1 bg-[#F4EFE6] text-[#1C1917] border border-[#1C1917]/15 px-2.5 py-1 rounded-xs text-[11px]"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-black/10 inline-block"
                    style={{ background: canonical.hexCode }}
                  />
                  {canonical.displayName}
                  <button
                    type="button"
                    onClick={() => removeColor(colKey)}
                    className="hover:text-red-700 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}

            {filters.onSaleOnly && (
              <span className="inline-flex items-center gap-1 bg-[#78281F] text-[#FAF8F5] px-2.5 py-1 rounded-xs text-[11px]">
                On Sale
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, onSaleOnly: false })}
                  className="hover:text-red-200 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={handleClearAllFilters}
              className="text-[#967029] hover:text-[#1C1917] transition-colors underline cursor-pointer text-[11px] ml-1"
            >
              Reset All
            </button>
          </div>
        )}

        {/* Main 12-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Desktop Filter Sidebar (Col 3) */}
          <div className="hidden lg:block lg:col-span-3 sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain pr-2 [scrollbar-width:thin] [scrollbar-color:#B88E3E_transparent]">
            <ProductFilterSidebar
              filters={filters}
              onFilterChange={setFilters}
              onClearAll={handleClearAllFilters}
              availableSubCategories={availableSubCategories}
              availableFabrics={availableFabrics}
              availableColors={availableColors}
              priceBounds={priceBounds}
              totalCount={filteredProducts.length}
            />
          </div>

          {/* Product Grid Area (Col 9 or 12) */}
          <div className="lg:col-span-9">
            {categoryPool.length === 0 ? (
              <div className="min-h-[340px] sm:min-h-[420px] flex flex-col items-center justify-center text-center px-5 py-12 border border-[#1C1917]/10 bg-[#F4EFE6]/50">
                <span className="text-[10px] uppercase tracking-[0.24em] text-[#967029] font-semibold mb-3">A new collection is being prepared</span>
                <h2 className="font-serif text-3xl sm:text-4xl text-[#1C1917] font-normal">Coming Soon</h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-[#57534E]">We're carefully curating this collection for VK VASTRAM. Please visit again soon for the first arrivals.</p>
                <button type="button" onClick={() => onNavigate({ type: 'home' })} className="mt-6 px-5 py-3 bg-[#1C1917] text-[#FAF8F5] text-xs tracking-[0.12em] uppercase hover:bg-[#78281F] transition-colors">Explore the Store</button>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="min-h-[260px] flex flex-col items-center justify-center text-center px-5 py-10 border border-[#1C1917]/10">
                <h2 className="font-serif text-2xl text-[#1C1917]">No matching creations</h2>
                <p className="mt-2 text-sm text-[#57534E]">Try changing your filters or resetting them to see more products.</p>
                <button type="button" onClick={handleClearAllFilters} className="mt-4 underline text-xs text-[#967029]">Reset filters</button>
              </div>
            ) : (
              <ProductGrid
                products={filteredProducts}
                wishlistIds={wishlistIds}
                columns={4}
                onToggleWishlist={onToggleWishlist}
                onSelectProduct={(slug) => onNavigate({ type: 'product', slug })}
                onQuickView={onQuickView}
                onAddToCart={onAddToCart}
              />
            )}
          </div>
        </div>

        {/* Mobile Filter Drawer */}
        <ProductFilterDrawer
          isOpen={isMobileFilterOpen}
          onClose={() => setIsMobileFilterOpen(false)}
          filters={filters}
          onFilterChange={setFilters}
          onClearAll={handleClearAllFilters}
          availableSubCategories={availableSubCategories}
          availableFabrics={availableFabrics}
          availableColors={availableColors}
          priceBounds={priceBounds}
          totalCount={filteredProducts.length}
        />
      </Container>
    </div>
  );
};
