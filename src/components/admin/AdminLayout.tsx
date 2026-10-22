import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Package,
  Upload,
  FolderTree,
  Layers,
  Boxes,
  Home,
  Settings,
  ShoppingBag,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Users,
  Star,
  Tag,
  BarChart3,
  ShieldCheck,
  Search,
  ChevronRight,
  FileText,
  Tags,
  BellRing,
} from 'lucide-react';
import { AdminSubView, PageView } from '../../types';
import { AdminUser } from '../../services/authService';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { adminService } from '../../services/adminService';
import { formatPrice } from '../ui/PriceDisplay';
import { AdminSareeTypes } from './AdminSareeTypes';
import { AdminOrderNotifications } from './AdminOrderNotifications';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { playOrderChime, vibrateForOrder, ensureAdminAppInstallTags } from '../../lib/adminAlerts';

interface AdminLayoutProps {
  currentSubView: AdminSubView;
  onNavigateSubView: (view: AdminSubView, productId?: string) => void;
  onNavigateStorefront: (page: PageView) => void;
  user: AdminUser;
  onLogout: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentSubView,
  onNavigateSubView,
  onNavigateStorefront,
  user,
  onLogout,
  children,
}) => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [adminNotificationsOpen, setAdminNotificationsOpen] = useState(false);
  const { settings } = useSiteSettings();
  const storeName = settings?.storeName || 'VK VASTRAM';

  // Global Search State
  const [searchQuery, setSearchQuery] = useState('');
  // Live "new order" alert while this admin page is open: chime, vibration and an on-screen banner.
  const [liveAlert, setLiveAlert] = useState<{ orderNumber: string; amount: number; kind: 'new' | 'paid' } | null>(null);

  // Install support: manifest + iPhone home-screen tags, and open the order from a notification link.
  useEffect(() => {
    ensureAdminAppInstallTags();
    const params = new URLSearchParams(window.location.search);
    if (params.get('order')) onNavigateSubView('orders');
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'vk-open-order') onNavigateSubView('orders');
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: a new real order (COD, or online payment captured) alerts the open admin page.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const announce = (row: any, kind: 'new' | 'paid') => {
      playOrderChime();
      vibrateForOrder();
      setLiveAlert({ orderNumber: String(row.order_number || ''), amount: Number(row.total_amount || 0), kind });
    };
    const channel = (supabase as any)
      .channel('admin-live-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload: any) => {
        const row = payload.new || {};
        if (row.order_status && row.order_status !== 'pending') announce(row, 'new');
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload: any) => {
        const row = payload.new || {};
        const before = String(payload.old?.payment_status || '').toLowerCase();
        const now = String(row.payment_status || '').toLowerCase();
        if (['captured', 'paid'].includes(now) && !['captured', 'paid'].includes(before)) announce(row, 'paid');
      })
      .subscribe();
    return () => { void (supabase as any).removeChannel(channel); };
  }, []);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    products: any[];
    categories: any[];
    collections: any[];
    orders: any[];
  }>({ products: [], categories: [], collections: [], orders: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Debounced search effect
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults({ products: [], categories: [], collections: [], orders: [] });
      setSearchOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const res = await adminService.globalAdminSearch(searchQuery);
      setSearchResults(res);
      setIsSearching(false);
      setSearchOpen(true);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener to close search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems: {
    label: string;
    view: AdminSubView;
    icon: React.ReactNode;
    active: boolean;
  }[] = [
    {
      label: 'Dashboard',
      view: 'dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      active: currentSubView === 'dashboard',
    },
    {
      label: 'Orders & Shipments',
      view: 'orders',
      icon: <ShoppingBag className="w-4 h-4" />,
      active: currentSubView === 'orders',
    },
    {
      label: 'Products',
      view: 'products',
      icon: <Package className="w-4 h-4" />,
      active: currentSubView === 'products' || currentSubView === 'products-new' || currentSubView === 'products-edit',
    },
    {
      label: 'Import Products',
      view: 'import',
      icon: <Upload className="w-4 h-4" />,
      active: currentSubView === 'import',
    },
    {
      label: 'Categories',
      view: 'categories',
      icon: <FolderTree className="w-4 h-4" />,
      active: currentSubView === 'categories',
    },
    {
      label: 'Collections',
      view: 'collections',
      icon: <Layers className="w-4 h-4" />,
      active: currentSubView === 'collections',
    },
    {
      label: 'Inventory Ledger',
      view: 'inventory',
      icon: <Boxes className="w-4 h-4" />,
      active: currentSubView === 'inventory',
    },
    {
      label: 'Homepage CMS',
      view: 'homepage',
      icon: <Home className="w-4 h-4" />,
      active: currentSubView === 'homepage',
    },
    {
      label: 'Coupons & Offers',
      view: 'coupons',
      icon: <Tag className="w-4 h-4" />,
      active: currentSubView === 'coupons',
    },
    {
      label: 'Store Settings',
      view: 'settings',
      icon: <Settings className="w-4 h-4" />,
      active: currentSubView === 'settings',
    },
    {
      label: 'Saree Types',
      view: 'saree-types',
      icon: <Tags className="w-4 h-4" />,
      active: currentSubView === 'saree-types',
    },
  ];

  const upcomingItems = [
    { label: 'Customers', icon: <Users className="w-4 h-4" /> },
    { label: 'Product Reviews', icon: <Star className="w-4 h-4" /> },
    { label: 'Sales Analytics', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#1C1917] flex">
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#1C1917] text-[#FAF8F5] shrink-0 border-r border-[#2E2926]">
        {/* Brand Header */}
        <div className="h-18 flex items-center justify-between px-6 border-b border-[#2E2926]">
          <div className="flex items-center gap-2.5">
            <span className="font-serif text-lg font-medium tracking-[0.18em] text-[#FAF8F5] uppercase">
              {storeName}
            </span>
          </div>
          <span className="text-[10px] uppercase font-semibold tracking-wider bg-[#FAF8F5]/10 text-[#B88E3E] px-2 py-0.5 rounded-xs">
            Admin
          </span>
        </div>

        {/* Primary Navigation Items */}
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-6">
          <div>
            <p className="px-3 text-[10px] uppercase tracking-[0.2em] text-[#78716C] font-semibold mb-2">
              Store Management
            </p>
            <div className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.view}
                  onClick={() => onNavigateSubView(item.view)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xs text-xs font-medium transition-colors cursor-pointer ${
                    item.active
                      ? 'bg-[#2E2926] text-[#FAF8F5] font-semibold border-l-2 border-[#B88E3E]'
                      : 'text-[#A8A29E] hover:bg-[#2E2926]/50 hover:text-[#FAF8F5]'
                  }`}
                >
                  <span className={item.active ? 'text-[#B88E3E]' : 'text-[#78716C]'}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Upcoming Extension Modules */}
          <div>
            <p className="px-3 text-[10px] uppercase tracking-[0.2em] text-[#78716C] font-semibold mb-2">
              Upcoming Modules
            </p>
            <div className="space-y-1">
              {upcomingItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-2 text-xs text-[#78716C] select-none opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[9px] uppercase tracking-wider bg-[#2E2926] text-[#A8A29E] px-1.5 py-0.5 rounded-xs">
                    Phase 7
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* User Footer Section */}
        <div className="p-4 border-t border-[#2E2926] bg-[#171412]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#FAF8F5] truncate">{user.fullName}</p>
              <p className="text-[11px] text-[#A8A29E] truncate">{user.email}</p>
            </div>
            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 text-[#A8A29E] hover:text-[#FAF8F5] hover:bg-[#2E2926] rounded-xs transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#1C1917]/70 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative w-72 bg-[#1C1917] text-[#FAF8F5] h-full shadow-2xl flex flex-col z-10">
            <div className="h-16 flex items-center justify-between px-5 border-b border-[#2E2926]">
              <span className="font-serif text-lg font-medium tracking-[0.18em] text-[#FAF8F5] uppercase">
                {storeName}
              </span>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1 text-[#A8A29E] hover:text-[#FAF8F5]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.view}
                  onClick={() => {
                    onNavigateSubView(item.view);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xs text-xs font-medium transition-colors ${
                    item.active
                      ? 'bg-[#2E2926] text-[#FAF8F5] font-semibold border-l-2 border-[#B88E3E]'
                      : 'text-[#A8A29E] hover:bg-[#2E2926]/50 hover:text-[#FAF8F5]'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-[#2E2926]">
              <button
                onClick={onLogout}
                className="w-full py-2 bg-[#2E2926] text-xs text-[#FAF8F5] rounded-xs flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {adminNotificationsOpen && <div className="absolute right-3 top-16 z-[100] w-[calc(100vw-1.5rem)] sm:w-auto max-w-lg shadow-xl">
        <div className="flex justify-end bg-[#FAF8F5] border-x border-t border-[#B88E3E]/30 px-3 pt-2"><button type="button" onClick={() => setAdminNotificationsOpen(false)} className="p-2 text-sm" aria-label="Close notification settings">Close ×</button></div>
        <AdminOrderNotifications />
      </div>}
      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 bg-[#FAF8F5] border-b border-[#1C1917]/10 flex items-center justify-between px-4 sm:px-8 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 text-[#1C1917] hover:bg-[#F4EFE6] rounded-xs cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs text-[#78716C]">
              <ShieldCheck className="w-4 h-4 text-[#967029]" />
              <span className="hidden sm:inline font-medium text-[#1C1917]">{storeName} Control Center</span>
              <span>/</span>
              <span className="capitalize font-semibold text-[#1C1917]">
                {currentSubView.replace('-', ' ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" aria-label="Admin order notification settings" title="Admin order alerts" onClick={() => setAdminNotificationsOpen(v => !v)} className="relative min-h-10 min-w-10 inline-flex items-center justify-center border border-[#1C1917]/15 text-[#1C1917] hover:bg-[#F4EFE6]">
              <BellRing className="h-5 w-5" aria-hidden="true"/><span className="sr-only">Admin order alerts</span>
            </button>
            {/* Admin Global Search Bar */}
            <div ref={searchContainerRef} className="relative hidden md:block w-72 lg:w-96">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (searchQuery.trim().length >= 2) setSearchOpen(true);
                  }}
                  placeholder="Global search (Products, SKU, Orders, Categories)..."
                  className="w-full bg-[#F4EFE6] text-xs text-[#1C1917] placeholder-[#78716C] pl-9 pr-8 py-2 rounded-xs border border-transparent focus:border-[#B88E3E] focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchOpen(false);
                    }}
                    className="absolute right-2.5 top-2.5 text-[#78716C] hover:text-[#1C1917]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Global Search Results Dropdown Overlay */}
              {searchOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#FAF8F5] border border-[#1C1917]/15 rounded-xs shadow-2xl z-50 max-h-96 overflow-y-auto divide-y divide-[#1C1917]/10 text-xs">
                  {isSearching ? (
                    <div className="p-4 text-center text-[#78716C]">
                      Searching catalogue & ledger...
                    </div>
                  ) : Object.values(searchResults).every((arr) => arr.length === 0) ? (
                    <div className="p-4 text-center text-[#78716C]">
                      No matching records found for "{searchQuery}".
                    </div>
                  ) : (
                    <>
                      {/* Products Results */}
                      {searchResults.products.length > 0 && (
                        <div className="p-2">
                          <p className="px-2 py-1 text-[10px] uppercase font-bold text-[#78716C] tracking-wider">
                            Products
                          </p>
                          {searchResults.products.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setSearchOpen(false);
                                onNavigateSubView('products-edit', p.id);
                              }}
                              className="w-full text-left px-2 py-1.5 hover:bg-[#F4EFE6] rounded-xs flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <div className="min-w-0 pr-2">
                                <p className="font-serif font-medium text-[#1C1917] truncate">{p.name}</p>
                                <p className="font-mono text-[10px] text-[#78716C]">SKU: {p.sku}</p>
                              </div>
                              <span className="font-medium text-[#1C1917] tabular-nums shrink-0">{formatPrice(p.price)}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Orders Results */}
                      {searchResults.orders.length > 0 && (
                        <div className="p-2">
                          <p className="px-2 py-1 text-[10px] uppercase font-bold text-[#78716C] tracking-wider">
                            Orders
                          </p>
                          {searchResults.orders.map((o) => (
                            <button
                              key={o.id}
                              onClick={() => {
                                setSearchOpen(false);
                                onNavigateSubView('orders');
                              }}
                              className="w-full text-left px-2 py-1.5 hover:bg-[#F4EFE6] rounded-xs flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <div className="min-w-0 pr-2">
                                <p className="font-mono font-medium text-[#1C1917] truncate">Order #{o.orderNumber}</p>
                                <p className="text-[10px] text-[#78716C] truncate">{o.customerName} • Status: {o.orderStatus}</p>
                              </div>
                              <span className="font-medium text-[#1C1917] tabular-nums shrink-0">{formatPrice(o.totalAmount)}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Categories Results */}
                      {searchResults.categories.length > 0 && (
                        <div className="p-2">
                          <p className="px-2 py-1 text-[10px] uppercase font-bold text-[#78716C] tracking-wider">
                            Categories
                          </p>
                          {searchResults.categories.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => {
                                setSearchOpen(false);
                                onNavigateSubView('categories');
                              }}
                              className="w-full text-left px-2 py-1.5 hover:bg-[#F4EFE6] rounded-xs flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <span className="font-serif font-medium text-[#1C1917]">{c.name}</span>
                              <span className="font-mono text-[10px] text-[#78716C]">{c.slug}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Collections Results */}
                      {searchResults.collections.length > 0 && (
                        <div className="p-2">
                          <p className="px-2 py-1 text-[10px] uppercase font-bold text-[#78716C] tracking-wider">
                            Collections
                          </p>
                          {searchResults.collections.map((col) => (
                            <button
                              key={col.id}
                              onClick={() => {
                                setSearchOpen(false);
                                onNavigateSubView('collections');
                              }}
                              className="w-full text-left px-2 py-1.5 hover:bg-[#F4EFE6] rounded-xs flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <span className="font-serif font-medium text-[#1C1917]">{col.name}</span>
                              <span className="font-mono text-[10px] text-[#78716C]">{col.slug}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => onNavigateStorefront({ type: 'home' })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#57534E] hover:text-[#1C1917] bg-[#F4EFE6] hover:bg-[#EFE9DC] rounded-xs transition-colors cursor-pointer border border-[#1C1917]/10 shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">View Storefront</span>
            </button>
          </div>
        </header>

        {/* Content Body Container */}
        {liveAlert && (
          <div role="alert" className="fixed top-3 left-1/2 -translate-x-1/2 z-[200] w-[min(92vw,28rem)] bg-[#1C1917] text-[#FAF8F5] rounded-xs shadow-xl px-4 py-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => { onNavigateSubView('orders'); setLiveAlert(null); }}
              className="flex-1 text-left min-w-0 cursor-pointer"
            >
              <span className="block text-[11px] uppercase tracking-wider text-[#B88E3E]">
                {liveAlert.kind === 'paid' ? 'Payment received' : 'New order'}
              </span>
              <span className="block text-sm font-medium truncate">
                {liveAlert.orderNumber} · ₹{liveAlert.amount.toLocaleString('en-IN')}
              </span>
              <span className="block text-[11px] text-[#FAF8F5]/70">Tap to open orders</span>
            </button>
            <button
              type="button"
              aria-label="Dismiss alert"
              onClick={() => setLiveAlert(null)}
              className="text-[#FAF8F5]/70 hover:text-white px-2 py-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
