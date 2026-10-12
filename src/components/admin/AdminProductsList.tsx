import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Plus,
  Search,
  SlidersHorizontal,
  ExternalLink,
  Edit,
  Eye,
  CheckCircle,
  Archive,
  RefreshCw,
  RotateCcw,
  Trash2,
  AlertTriangle,
  X,
  ShieldAlert,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { Product, AdminSubView, PageView } from '../../types';
import { formatPrice } from '../ui/PriceDisplay';

interface AdminProductsListProps {
  onNavigateSubView: (view: AdminSubView, productId?: string) => void;
  onNavigateStorefront: (page: PageView) => void;
}

export const AdminProductsList: React.FC<AdminProductsListProps> = ({
  onNavigateSubView,
  onNavigateStorefront,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modal states for safe delete
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteSafety, setDeleteSafety] = useState<{ safe: boolean; reason?: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    const data = await adminService.getProducts({
      search: searchTerm,
      status: statusFilter,
      category: categoryFilter,
    });
    setProducts(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, [statusFilter, categoryFilter]);

  const exportProductsExcel = () => {
    const rows = products.map((p: any) => ({ 'Product ID': p.id, SKU: p.sku || '', Name: p.name || p.title || '', Category: p.category || '', 'Saree Type': p.sareeType || p.saree_type || '', Price: Number(p.price || 0), 'Compare At Price': Number(p.compareAtPrice || p.compare_at_price || 0), Status: p.status || '', Stock: p.stockQuantity ?? p.stock_quantity ?? p.stock ?? '', 'Created At': p.createdAt || p.created_at || '' }));
    if (!rows.length) { alert('No products loaded to export.'); return; }
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Products'); XLSX.writeFile(wb, `vk-vastram-products-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts();
  };

  const handleToggleStatus = async (id: string, currentStatus?: string) => {
    const nextStatus = currentStatus === 'active' ? 'draft' : 'active';
    await adminService.setProductStatus(id, nextStatus);
    fetchProducts();
  };

  const handleArchive = async (id: string) => {
    await adminService.setProductStatus(id, 'archived');
    fetchProducts();
  };

  const handleRestore = async (id: string) => {
    await adminService.setProductStatus(id, 'active');
    fetchProducts();
  };

  const handleDeleteClick = async (product: Product) => {
    setSelectedProduct(product);
    setDeleting(true);
    const check = await adminService.checkProductDeleteSafety(product.id);
    setDeleteSafety(check);
    setDeleting(false);
    setDeleteModalOpen(true);
  };

  const handleConfirmHardDelete = async () => {
    if (!selectedProduct) return;
    setDeleting(true);
    const res = await adminService.deleteProductSafely(selectedProduct.id);
    setDeleting(false);
    setDeleteModalOpen(false);
    setSelectedProduct(null);
    if (res.success) {
      fetchProducts();
    } else {
      alert(res.error || 'Delete failed.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#1C1917] font-normal">
            Product Catalog
          </h1>
          <p className="text-xs text-[#57534E] mt-1">
            Manage handloom sarees, artisanal bedding sets, and merchandising attributes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button onClick={exportProductsExcel} className="px-3 py-2 text-xs border border-[#1C1917]/15 rounded-xs hover:bg-[#F4EFE6]">Export Excel</button>
          <button
            onClick={fetchProducts}
            title="Refresh product list"
            className="p-2 bg-[#FAF8F5] border border-[#1C1917]/15 rounded-xs hover:bg-[#F4EFE6] text-[#57534E] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => onNavigateSubView('products-new')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1C1917] hover:bg-[#2E2926] text-[#FAF8F5] text-xs font-medium rounded-xs transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#FAF8F5] p-4 rounded-xs border border-[#1C1917]/10 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#78716C] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, SKU, or fabric..."
            className="w-full bg-[#F4EFE6] text-xs text-[#1C1917] placeholder-[#78716C] pl-9 pr-3 py-2 rounded-xs border border-transparent focus:border-[#B88E3E] focus:outline-none"
          />
        </form>

        {/* Dropdown Filters */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5 bg-[#F4EFE6] border border-[#1C1917]/10 px-2.5 py-1.5 rounded-xs text-xs">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#78716C]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs text-[#1C1917] focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active (Published)</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-[#F4EFE6] border border-[#1C1917]/10 px-2.5 py-1.5 rounded-xs text-xs">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent text-xs text-[#1C1917] focus:outline-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="sarees">Sarees</option>
              <option value="bedsheets">Bedsheets</option>
              <option value="home-textiles">Home Textiles</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-[#FAF8F5] rounded-xs border border-[#1C1917]/10 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F4EFE6] text-[#78716C] uppercase text-[10px] tracking-wider border-b border-[#1C1917]/10">
              <tr>
                <th className="px-5 py-3 font-semibold">Product & SKU</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Selling Price</th>
                <th className="px-4 py-3 font-semibold">MRP</th>
                <th className="px-4 py-3 font-semibold">Stock</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C1917]/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-[#78716C]">
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-[#78716C]">
                    No products found matching the criteria.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-[#F4EFE6]/50 transition-colors">
                    {/* Name & Image */}
                    <td className="px-5 py-3.5 flex items-center gap-3">
                      {product.primaryImage ? (
                        <img
                          src={product.primaryImage}
                          alt={product.name}
                          loading="lazy"
                          className="w-11 h-14 object-cover rounded-xs bg-[#EFE9DC] shrink-0 border border-[#1C1917]/5"
                        />
                      ) : (
                        <div className="w-11 h-14 flex items-center justify-center text-[9px] text-[#78716C] bg-[#EFE9DC] shrink-0 border border-[#1C1917]/5" aria-label="No product image">No image</div>
                      )}
                      <div className="min-w-0 max-w-xs">
                        <p className="font-medium text-[#1C1917] font-serif text-sm truncate">
                          {product.name}
                        </p>
                        <p className="text-[10px] text-[#78716C] font-mono mt-0.5">
                          SKU: {product.sku || product.slug}
                        </p>
                        {product.featured && (
                          <span className="inline-block mt-0.5 text-[9px] uppercase font-semibold text-[#967029] bg-[#F7F1E5] px-1.5 py-0.2 rounded-xs">
                            Featured
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3.5 text-[#57534E]">
                      {product.categoryLabel}
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3.5 font-medium tabular-nums text-[#1C1917]">
                      {formatPrice(product.price)}
                    </td>

                    {/* MRP */}
                    <td className="px-4 py-3.5 text-[#78716C] tabular-nums">
                      {product.mrp ? formatPrice(product.mrp) : '—'}
                    </td>

                    {/* Stock */}
                    <td className="px-4 py-3.5 tabular-nums">
                      <span
                        className={`font-semibold ${
                          (product.stockQuantity || 0) > 5
                            ? 'text-emerald-700'
                            : (product.stockQuantity || 0) > 0
                            ? 'text-amber-700'
                            : 'text-red-700'
                        }`}
                      >
                        {product.stockQuantity ?? 10} units
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => handleToggleStatus(product.id, product.status)}
                        title="Click to toggle publish status"
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xs text-[10px] uppercase tracking-wider font-semibold cursor-pointer transition-colors ${
                          product.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : product.status === 'draft'
                            ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                            : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
                        }`}
                      >
                        <CheckCircle className="w-3 h-3" />
                        <span>{product.status || 'Active'}</span>
                      </button>
                    </td>

                    {/* Action buttons */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => onNavigateSubView('products-edit', product.id)}
                          title="Edit Product"
                          className="p-1.5 text-[#57534E] hover:text-[#1C1917] hover:bg-[#EFE9DC] rounded-xs transition-colors cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onNavigateStorefront({ type: 'product', slug: product.slug })}
                          title="View on Storefront"
                          className="p-1.5 text-[#57534E] hover:text-[#967029] hover:bg-[#EFE9DC] rounded-xs transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {product.status === 'archived' ? (
                          <button
                            onClick={() => handleRestore(product.id)}
                            title="Restore Product to Active Storefront"
                            className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-xs transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-medium"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Restore</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleArchive(product.id)}
                            title="Archive Product (Hide from storefront)"
                            className="p-1.5 text-[#78716C] hover:text-amber-700 hover:bg-amber-50 rounded-xs transition-colors cursor-pointer"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteClick(product)}
                          title="Hard Delete Product (Safety Verification Required)"
                          className="p-1.5 text-[#78716C] hover:text-red-700 hover:bg-red-50 rounded-xs transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Safe Delete Confirmation / Protection Modal */}
      {deleteModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/70 backdrop-blur-xs">
          <div className="bg-[#FAF8F5] border border-[#1C1917]/20 rounded-xs max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-[#1C1917]/10 pb-3">
              <div className="flex items-center gap-2.5">
                {deleteSafety?.safe ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <h3 className="font-serif text-lg text-[#1C1917] font-semibold">
                  {deleteSafety?.safe ? 'Confirm Permanent Hard Delete' : 'Hard Delete Blocked — Historical Data Exists'}
                </h3>
              </div>
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="p-1 text-[#78716C] hover:text-[#1C1917]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#57534E]">
              <div className="bg-[#F4EFE6] p-3 rounded-xs border border-[#1C1917]/10 space-y-1">
                <p className="font-semibold text-[#1C1917] font-serif text-sm">{selectedProduct.name}</p>
                <p className="font-mono text-[11px] text-[#78716C]">SKU: {selectedProduct.sku || selectedProduct.slug}</p>
              </div>

              {deleteSafety?.safe ? (
                <>
                  <p className="text-[#1C1917] font-medium">
                    This product has no historical orders or inventory movements and is safe to permanently remove.
                  </p>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xs text-amber-800 text-[11px]">
                    <p className="font-semibold mb-0.5">Storage Cleanup Impact:</p>
                    <p>Associated images will be removed from Supabase Storage only if no other product or CMS section references them.</p>
                  </div>
                </>
              ) : (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xs text-red-900 space-y-2">
                  <p className="font-semibold text-xs">{deleteSafety?.reason}</p>
                  <p className="text-[11px] text-red-700">
                    Deleting a product with historical transactions distorts financial ledgers and customer order tracking. Please use the <strong>Archive</strong> feature instead.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1C1917]/10">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-[#57534E] hover:bg-[#F4EFE6] rounded-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>

              {deleteSafety?.safe ? (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleConfirmHardDelete}
                  className="px-4 py-2 text-xs font-medium bg-red-700 hover:bg-red-800 text-white rounded-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deleting ? 'Deleting...' : 'Confirm Hard Delete'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    await handleArchive(selectedProduct.id);
                    setDeleteModalOpen(false);
                  }}
                  className="px-4 py-2 text-xs font-medium bg-[#1C1917] hover:bg-[#2E2926] text-[#FAF8F5] rounded-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archive Product Instead</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
