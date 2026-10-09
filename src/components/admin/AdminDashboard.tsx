import React, { useEffect, useState } from 'react';
import {
  Package,
  CheckCircle2,
  AlertTriangle,
  FolderTree,
  Layers,
  Plus,
  ArrowRight,
  Boxes,
  Home,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { adminService, DashboardStats } from '../../services/adminService';
import { formatPrice } from '../ui/PriceDisplay';
import { AdminSubView, Product } from '../../types';

interface AdminDashboardProps {
  onNavigateSubView: (view: AdminSubView, productId?: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateSubView }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    const data = await adminService.getDashboardStats();
    setStats(data);
    setLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#1C1917] font-normal">
            Store Overview
          </h1>
          <p className="text-xs text-[#57534E] mt-1">
            Real-time catalog, stock, and merchandising telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadStats}
            title="Refresh statistics"
            className="p-2 bg-[#FAF8F5] border border-[#1C1917]/15 rounded-xs hover:bg-[#F4EFE6] text-[#57534E] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => onNavigateSubView('products-new')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1C1917] hover:bg-[#2E2926] text-[#FAF8F5] text-xs font-medium rounded-xs transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Products */}
        <div className="bg-[#FAF8F5] p-5 rounded-xs border border-[#1C1917]/10 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-[#78716C]">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Total Catalog</span>
            <Package className="w-4 h-4 text-[#967029]" />
          </div>
          <p className="font-serif text-3xl font-medium text-[#1C1917] tabular-nums">
            {loading ? '...' : stats?.totalProducts}
          </p>
          <span className="text-[11px] text-[#78716C] block">Unique designs in database</span>
        </div>

        {/* Active Products */}
        <div className="bg-[#FAF8F5] p-5 rounded-xs border border-[#1C1917]/10 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-[#78716C]">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Published</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-serif text-3xl font-medium text-emerald-800 tabular-nums">
            {loading ? '...' : stats?.activeProducts}
          </p>
          <span className="text-[11px] text-[#78716C] block">Live on storefront</span>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-[#FAF8F5] p-5 rounded-xs border border-[#1C1917]/10 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-[#78716C]">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Low Stock</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="font-serif text-3xl font-medium text-amber-800 tabular-nums">
            {loading ? '...' : stats?.lowStockCount}
          </p>
          <button
            onClick={() => onNavigateSubView('inventory')}
            className="text-[11px] text-[#967029] hover:underline block cursor-pointer"
          >
            Review inventory →
          </button>
        </div>

        {/* Categories */}
        <div className="bg-[#FAF8F5] p-5 rounded-xs border border-[#1C1917]/10 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-[#78716C]">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Categories</span>
            <FolderTree className="w-4 h-4 text-[#967029]" />
          </div>
          <p className="font-serif text-3xl font-medium text-[#1C1917] tabular-nums">
            {loading ? '...' : stats?.categoriesCount}
          </p>
          <span className="text-[11px] text-[#78716C] block">Sarees, Bedsheets, etc.</span>
        </div>

        {/* Collections */}
        <div className="bg-[#FAF8F5] p-5 rounded-xs border border-[#1C1917]/10 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-[#78716C]">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Collections</span>
            <Layers className="w-4 h-4 text-[#967029]" />
          </div>
          <p className="font-serif text-3xl font-medium text-[#1C1917] tabular-nums">
            {loading ? '...' : stats?.collectionsCount}
          </p>
          <span className="text-[11px] text-[#78716C] block">Curated store themes</span>
        </div>
      </div>

      {/* Incoming Orders & Fulfillment Pipeline */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[#1C1917] uppercase tracking-wider">
            Incoming Orders & Fulfillment Pipeline
          </h3>
          <button
            onClick={() => onNavigateSubView('orders')}
            className="text-xs text-[#967029] hover:underline cursor-pointer"
          >
            Fulfillment Center →
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {/* Revenue */}
          <div className="bg-[#FAF8F5] p-4 rounded-xs border border-[#1C1917]/10 shadow-2xs space-y-1.5 md:col-span-2">
            <div className="flex items-center justify-between text-[#78716C]">
              <span className="text-[10px] uppercase tracking-wider font-semibold">Total Revenue</span>
              <CheckCircle2 className="w-4 h-4 text-[#967029]" />
            </div>
            <p className="font-serif text-2xl font-semibold text-[#1C1917] tabular-nums">
              {loading ? '...' : formatPrice(stats?.revenue || 0)}
            </p>
            <span className="text-[10px] text-[#78716C] block">From captured online payments</span>
          </div>

          {/* Orders Today */}
          <div className="bg-[#FAF8F5] p-4 rounded-xs border border-[#1C1917]/10 shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between text-[#78716C]">
              <span className="text-[10px] uppercase tracking-wider font-semibold">Orders Today</span>
              <Package className="w-4 h-4 text-[#967029]" />
            </div>
            <p className="font-serif text-2xl font-semibold text-[#1C1917] tabular-nums">
              {loading ? '...' : stats?.ordersToday || 0}
            </p>
            <span className="text-[10px] text-[#78716C] block">Incoming today</span>
          </div>

          {/* Orders to Pack */}
          <div className="bg-[#FAF8F5] p-4 rounded-xs border border-[#1C1917]/10 shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between text-[#78716C]">
              <span className="text-[10px] uppercase tracking-wider font-semibold">To Pack</span>
              <div className="w-2 h-2 rounded-full bg-blue-500" />
            </div>
            <p className="font-serif text-2xl font-semibold text-[#1C1917] tabular-nums">
              {loading ? '...' : stats?.ordersToPack || 0}
            </p>
            <span className="text-[10px] text-[#78716C] block">Fulfillment pending</span>
          </div>

          {/* Orders to Ship */}
          <div className="bg-[#FAF8F5] p-4 rounded-xs border border-[#1C1917]/10 shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between text-[#78716C]">
              <span className="text-[10px] uppercase tracking-wider font-semibold">To Ship</span>
              <div className="w-2 h-2 rounded-full bg-purple-500" />
            </div>
            <p className="font-serif text-2xl font-semibold text-[#1C1917] tabular-nums">
              {loading ? '...' : stats?.ordersToPack || 0}
            </p>
            <span className="text-[10px] text-[#78716C] block">Packed & ready</span>
          </div>

          {/* Pending Payment */}
          <div className="bg-[#FAF8F5] p-4 rounded-xs border border-[#1C1917]/10 shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between text-[#78716C]">
              <span className="text-[10px] uppercase tracking-wider font-semibold">Pending Pay</span>
              <div className="w-2 h-2 rounded-full bg-amber-500" />
            </div>
            <p className="font-serif text-2xl font-semibold text-[#1C1917] tabular-nums">
              {loading ? '...' : stats?.pendingPaymentCount || 0}
            </p>
            <span className="text-[10px] text-[#78716C] block">Awaiting checkout pay</span>
          </div>
        </div>
      </div>

      {/* Quick Action Shortcuts Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => onNavigateSubView('inventory')}
          className="p-4 bg-[#FAF8F5] border border-[#1C1917]/10 rounded-xs hover:border-[#B88E3E] transition-all cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xs bg-[#F4EFE6] flex items-center justify-center text-[#967029]">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#1C1917]">Manage Inventory</p>
              <p className="text-[11px] text-[#78716C]">Log stock purchases & adjustments</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[#78716C] group-hover:translate-x-1 transition-transform" />
        </div>

        <div
          onClick={() => onNavigateSubView('homepage')}
          className="p-4 bg-[#FAF8F5] border border-[#1C1917]/10 rounded-xs hover:border-[#B88E3E] transition-all cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xs bg-[#F4EFE6] flex items-center justify-center text-[#967029]">
              <Home className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#1C1917]">Homepage CMS</p>
              <p className="text-[11px] text-[#78716C]">Update hero banner & campaigns</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[#78716C] group-hover:translate-x-1 transition-transform" />
        </div>

        <div
          onClick={() => onNavigateSubView('settings')}
          className="p-4 bg-[#FAF8F5] border border-[#1C1917]/10 rounded-xs hover:border-[#B88E3E] transition-all cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xs bg-[#F4EFE6] flex items-center justify-center text-[#967029]">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#1C1917]">Store Configuration</p>
              <p className="text-[11px] text-[#78716C]">Support email, phone & policies</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[#78716C] group-hover:translate-x-1 transition-transform" />
        </div>
      </div>

      {/* Recent Products Data Table */}
      <div className="bg-[#FAF8F5] rounded-xs border border-[#1C1917]/10 overflow-hidden shadow-2xs">
        <div className="px-6 py-4 border-b border-[#1C1917]/10 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-lg text-[#1C1917] font-normal">
              Recent Catalog Entries
            </h2>
            <p className="text-xs text-[#78716C]">Most recently modified products</p>
          </div>
          <button
            onClick={() => onNavigateSubView('products')}
            className="text-xs text-[#967029] hover:text-[#1C1917] font-medium cursor-pointer"
          >
            View All Products →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F4EFE6] text-[#78716C] uppercase text-[10px] tracking-wider border-b border-[#1C1917]/10">
              <tr>
                <th className="px-6 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Price</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C1917]/5">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[#78716C]">
                    Loading catalog data...
                  </td>
                </tr>
              ) : stats?.recentProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[#78716C]">
                    No products found. Click &quot;Add New Product&quot; to get started.
                  </td>
                </tr>
              ) : (
                stats?.recentProducts.map((product: Product) => (
                  <tr key={product.id} className="hover:bg-[#F4EFE6]/50 transition-colors">
                    <td className="px-6 py-3.5 flex items-center gap-3">
                      <img
                        src={product.primaryImage}
                        alt={product.name}
                        className="w-10 h-12 object-cover rounded-xs bg-[#EFE9DC] shrink-0 border border-[#1C1917]/5"
                      />
                      <div>
                        <p className="font-medium text-[#1C1917] font-serif text-sm">
                          {product.name}
                        </p>
                        <span className="text-[10px] text-[#78716C] font-mono">
                          {product.sku || product.slug}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-[#57534E]">
                      {product.categoryLabel}
                    </td>
                    <td className="px-4 py-3.5 font-medium tabular-nums text-[#1C1917]">
                      {formatPrice(product.price)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-xs text-[10px] uppercase tracking-wider font-semibold ${
                          product.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : product.status === 'draft'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-zinc-200 text-zinc-700'
                        }`}
                      >
                        {product.status || 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => onNavigateSubView('products-edit', product.id)}
                        className="text-xs font-medium text-[#967029] hover:text-[#1C1917] cursor-pointer"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
