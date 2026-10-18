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
  Sparkles,
  PartyPopper,
} from 'lucide-react';
import { adminService, DashboardStats } from '../../services/adminService';
import { formatPrice } from '../ui/PriceDisplay';
import { AdminSubView, Product } from '../../types';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { LaunchCelebrationOverlay } from './LaunchCelebrationOverlay';

interface AdminDashboardProps {
  onNavigateSubView: (view: AdminSubView, productId?: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateSubView }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [launchStatus, setLaunchStatus] = useState<'checking' | 'ready' | 'complete' | 'error'>('checking');
  const [launchBusy, setLaunchBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [celebrationUses, setCelebrationUses] = useState(0);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const celebrationUseLimit = 5;
  const maxPreviewUses = 4; // reserve the fifth and final possible run for the official launch
  const [showLaunchCelebration, setShowLaunchCelebration] = useState(false);
  const [celebrationMode, setCelebrationMode] = useState<'preview' | 'official'>('preview');

  const loadStats = async () => {
    setLoading(true);
    const data = await adminService.getDashboardStats();
    setStats(data);
    setLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadLaunchState = async () => {
      if (!isSupabaseConfigured()) {
        if (mounted) {
          setLaunchStatus('error');
          setLaunchError('Supabase is not configured, so the one-time launch state cannot be saved safely.');
        }
        return;
      }
      try {
        const [{ data, error }, { data: previewData, error: previewError }] = await Promise.all([
          (supabase as any)
            .from('site_settings')
            .select('value')
            .eq('key', 'launch_celebration')
            .maybeSingle(),
          (supabase as any)
            .from('site_settings')
            .select('value')
            .eq('key', 'launch_celebration_preview_usage')
            .maybeSingle(),
        ]);
        if (!mounted) return;
        if (error) throw error;
        if (previewError) throw previewError;
        // The shared counter tracks every celebration activation; the official marker controls its one-time state.
        setLaunchStatus(data ? 'complete' : 'ready');
        const savedCount = Number(previewData?.value?.count ?? (data ? 1 : 0));
        setCelebrationUses(Number.isFinite(savedCount) ? Math.max(0, Math.min(celebrationUseLimit, Math.floor(savedCount))) : 0);
        setLaunchError(null);
      } catch (error) {
        if (!mounted) return;
        setLaunchStatus('error');
        setLaunchError(error instanceof Error ? error.message : 'Could not verify the launch event state.');
      }
    };
    void loadLaunchState();
    return () => { mounted = false; };
  }, []);

  const previewLaunchCelebration = async () => {
    if (previewBusy || celebrationUses >= maxPreviewUses || launchStatus !== 'ready') return;
    setPreviewBusy(true);
    setLaunchError(null);
    try {
      // Atomic server-side increment: rehearsal allowance persists across admin sessions/devices.
      const { data, error } = await (supabase as any).rpc('consume_launch_celebration_use', { p_mode: 'preview' });
      if (error) throw error;
      const result = (Array.isArray(data) ? data[0] : data) as {
        allowed?: boolean; used?: number; limit?: number; remaining?: number; reason?: string;
      } | null;
      if (!result?.allowed) {
        const used = Number(result?.used ?? celebrationUseLimit);
        setCelebrationUses(Math.max(0, Math.min(celebrationUseLimit, used)));
        setLaunchError(result?.reason === 'official_already_completed'
          ? 'The official launch has already been completed. No more celebration previews are available.'
          : `The rehearsal preview limit has been reached (${Math.min(maxPreviewUses, used)}/${maxPreviewUses}). Preview is now disabled; the reserved official-launch use remains available.`);
        return;
      }
      const used = Number(result.used ?? celebrationUses + 1);
      setCelebrationUses(Math.max(0, Math.min(celebrationUseLimit, used)));
      setCelebrationMode('preview');
      setShowLaunchCelebration(true);
    } catch (error) {
      setLaunchError(error instanceof Error
        ? `Could not record this rehearsal. Apply the launch-preview Supabase migration and try again. (${error.message})`
        : 'Could not record this rehearsal. Apply the launch-preview Supabase migration and try again.');
    } finally {
      setPreviewBusy(false);
    }
  };

  const startOfficialLaunch = async () => {
    if (launchBusy || launchStatus !== 'ready') return;
    const confirmed = window.confirm(
      'Start the one-time VK VASTRAM launch celebration? This permanently records the event as completed and disables this button. Continue only when the client is ready to officially launch.'
    );
    if (!confirmed) return;

    setLaunchBusy(true);
    setLaunchError(null);
    try {
      // The RPC increments the shared five-use counter and records the official marker atomically.
      const { data, error } = await (supabase as any).rpc('consume_launch_celebration_use', { p_mode: 'official' });
      if (error) throw error;
      const result = (Array.isArray(data) ? data[0] : data) as {
        allowed?: boolean; used?: number; limit?: number; remaining?: number; reason?: string;
      } | null;
      if (!result?.allowed) {
        const used = Number(result?.used ?? celebrationUses);
        setCelebrationUses(Math.max(0, Math.min(celebrationUseLimit, used)));
        if (result?.reason === 'official_already_completed') setLaunchStatus('complete');
        setLaunchError(result?.reason === 'official_already_completed'
          ? 'The official launch was already completed in another admin session. Reload this dashboard.'
          : 'No celebration use remains. The official launch was not started.');
        return;
      }
      const used = Number(result.used ?? celebrationUses + 1);
      setCelebrationUses(Math.max(0, Math.min(celebrationUseLimit, used)));
      setLaunchStatus('complete');
      setCelebrationMode('official');
      setShowLaunchCelebration(true);
    } catch (error) {
      setLaunchError(error instanceof Error ? `Could not record the official launch. Confirm the launch-preview Supabase migration is applied. (${error.message})` : 'Could not record the official launch. Confirm the launch-preview Supabase migration is applied.');
    } finally {
      setLaunchBusy(false);
    }
  };

  const openStorefront = () => {
    window.open('/', '_blank', 'noopener,noreferrer');
    setShowLaunchCelebration(false);
  };

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

      {/* One-time official launch ceremony. A unique site_settings key prevents a second run. */}
      <section className="relative overflow-hidden rounded-sm border border-[#B88E3E]/40 bg-gradient-to-r from-[#F7F1E5] via-[#FAF8F5] to-[#F4EFE6] p-5 sm:p-6 shadow-xs">
        <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full border border-[#B88E3E]/20" />
        <div className="pointer-events-none absolute -right-1 -top-3 h-24 w-24 rounded-full border border-[#B88E3E]/20" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#B88E3E]/40 bg-white/70 text-[#967029]">
              <PartyPopper className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-serif text-xl text-[#78281F]">The Official Store Launch</h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#B88E3E]/40 bg-white/65 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#967029]">
                  <Sparkles className="h-3 w-3" /> One-time event
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#57534E]">
                A short full-screen celebration with falling confetti, floating festive doodles, and the VK VASTRAM launch message. There are five total celebration uses across all admin sessions: up to four rehearsals, with the final use reserved for the one-time official launch.
              </p>
              <p className="mt-2 text-[11px] font-medium text-[#78281F]" aria-live="polite">
                Celebration uses: {celebrationUses}/{celebrationUseLimit} · Up to {maxPreviewUses} rehearsals + one official launch
              </p>
              {launchError && <p role="alert" className="mt-2 text-xs text-[#78281F]">{launchError}</p>}
            </div>
          </div>
          <div className="shrink-0 sm:text-right">
            {launchStatus !== 'complete' && (
              <button
                type="button"
                onClick={previewLaunchCelebration}
                disabled={launchStatus !== 'ready' || previewBusy || celebrationUses >= maxPreviewUses}
                className="mb-2 mr-0 inline-flex items-center justify-center gap-2 rounded-sm border border-[#B88E3E]/60 bg-white/70 px-4 py-2.5 text-xs font-semibold text-[#78281F] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 sm:mr-2"
              >
                <Sparkles className={`h-4 w-4 ${previewBusy ? 'animate-spin' : ''}`} />
                {previewBusy ? 'Recording rehearsal…' : celebrationUses >= maxPreviewUses ? 'Rehearsal limit reached' : `Preview celebration (${Math.max(0, maxPreviewUses - celebrationUses)} left)`}
              </button>
            )}
            {launchStatus === 'complete' ? (
              <div className="inline-flex items-center gap-2 rounded-sm border border-emerald-800/20 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> Official launch completed
              </div>
            ) : (
              <button
                type="button"
                onClick={startOfficialLaunch}
                disabled={launchStatus !== 'ready' || launchBusy}
                className="inline-flex items-center justify-center gap-2 rounded-sm bg-[#1C1917] px-5 py-3 text-xs font-semibold text-[#FAF8F5] shadow-sm transition hover:bg-[#78281F] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className={`h-4 w-4 ${launchBusy ? 'animate-spin' : ''}`} />
                {launchStatus === 'checking' ? 'Checking launch status…' : launchBusy ? 'Preparing launch…' : launchStatus === 'error' ? 'Launch unavailable' : 'Start Official Launch'}
              </button>
            )}
            <p className="mt-2 text-[10px] text-[#78716C]">Admin-only · 5 total uses · official launch reserved</p>
          </div>
        </div>
      </section>

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
      {showLaunchCelebration && (
        <LaunchCelebrationOverlay
          mode={celebrationMode}
          onClose={() => setShowLaunchCelebration(false)}
          onOpenStorefront={openStorefront}
        />
      )}
    </div>
  );
};
