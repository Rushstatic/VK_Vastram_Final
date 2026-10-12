import { useState, useEffect, useCallback } from 'react';
import { AnnouncementBar } from './components/common/AnnouncementBar';
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { HeroSection } from './components/home/HeroSection';
import { CategoryShowcase } from './components/home/CategoryShowcase';
import { CraftsmanshipStory } from './components/home/CraftsmanshipStory';
import { TrustGuarantees } from './components/home/TrustGuarantees';
import { ProductGrid } from './components/catalog/ProductGrid';
import { ProductDetailModal } from './components/catalog/ProductDetailModal';
import { HorizontalProductRail } from './components/catalog/HorizontalProductRail';
import { recentlyViewedService } from './services/recentlyViewedService';
import { CartDrawer } from './components/cart/CartDrawer';
import { WishlistDrawer } from './components/wishlist/WishlistDrawer';
import { SearchModal } from './components/search/SearchModal';
import { ProductDetailPage } from './components/pages/ProductDetailPage';
import { CollectionPage } from './components/pages/CollectionPage';
import { SalePage } from './components/pages/SalePage';
import { AboutPage } from './components/pages/AboutPage';
import { FaqPage } from './components/pages/FaqPage';
import { ContactPage } from './components/pages/ContactPage';
import { WishlistPage } from './components/pages/WishlistPage';
import { CartPage } from './components/pages/CartPage';
import { CheckoutPage } from './components/checkout/CheckoutPage';
import { OrderConfirmationPage } from './components/checkout/OrderConfirmationPage';
import { CustomerLogin } from './components/auth/CustomerLogin';
import { CustomerRegister } from './components/auth/CustomerRegister';
import { ForgotPassword } from './components/auth/ForgotPassword';
import { ResetPassword } from './components/auth/ResetPassword';
import { AccountPage } from './components/account/AccountPage';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminOrders } from './components/admin/AdminOrders';
import { AdminProductsList } from './components/admin/AdminProductsList';
import { AdminProductForm } from './components/admin/AdminProductForm';
import { AdminImport } from './components/admin/AdminImport';
import { AdminCategories } from './components/admin/AdminCategories';
import { AdminCollections } from './components/admin/AdminCollections';
import { AdminInventory } from './components/admin/AdminInventory';
import { AdminHomepage } from './components/admin/AdminHomepage';
import { AdminSettings } from './components/admin/AdminSettings';
import { AdminCoupons } from './components/admin/AdminCoupons';
import { AdminSareeTypes } from './components/admin/AdminSareeTypes';
import { Container } from './components/ui/Container';
import { SectionHeading } from './components/ui/SectionHeading';
import { ScrollReveal } from './components/ui/ScrollReveal';
import { Button } from './components/ui/Button';
import { ScrollTrigger } from './lib/gsap';
import { productService } from './services/productService';
import { authService, AdminUser } from './services/authService';
import { cartService } from './services/cartService';
import { orderService } from './services/orderService';
import { customerService } from './services/customerService';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { Product, PageView, CartItem, AdminSubView } from './types';
import { PRODUCTS } from './data/catalog';
import { ArrowRight } from 'lucide-react';
import { useSiteSettings } from './hooks/useSiteSettings';

import { sanitizeQuantity, MAX_CART_ITEM_QUANTITY } from './lib/validation';

// Client-side URL Path/SPA Routing helper maps
const getPathFromPage = (page: PageView): string => {
  switch (page.type) {
    case 'home': return '/';
    case 'about': return '/about';
    case 'faq': return '/faq';
    case 'contact': return '/contact';
    case 'wishlist': return '/wishlist';
    case 'cart': return '/cart';
    case 'checkout': return '/checkout';
    case 'login': return '/login';
    case 'register': return '/register';
    case 'forgot-password': return '/forgot-password';
    case 'reset-password': return '/reset-password';
    case 'account': return '/account';
    case 'admin-login': return '/admin/login';
    case 'admin': {
      const sub = page.subView || 'dashboard';
      return `/admin/${sub}`;
    }
    case 'collection': return `/collection/${page.category}`;
    case 'product': return `/product/${page.slug}`;
    case 'sale': return '/sale';
    default: return '/';
  }
};

const getPageFromPath = (path: string): PageView => {
  const cleanPath = path.toLowerCase().trim().replace(/\/$/, '');
  if (!cleanPath || cleanPath === '') return { type: 'home' };
  if (cleanPath === '/about') return { type: 'about' };
  if (cleanPath === '/faq') return { type: 'faq' };
  if (cleanPath === '/contact') return { type: 'contact' };
  if (cleanPath === '/wishlist') return { type: 'wishlist' };
  if (cleanPath === '/cart') return { type: 'cart' };
  if (cleanPath === '/checkout') return { type: 'checkout' };
  if (cleanPath === '/login') return { type: 'login' };
  if (cleanPath === '/register') return { type: 'register' };
  if (cleanPath === '/forgot-password') return { type: 'forgot-password' };
  if (cleanPath === '/reset-password') return { type: 'reset-password' };
  if (cleanPath === '/account') return { type: 'account' };
  if (cleanPath === '/admin/login' || cleanPath === '/admin-login') return { type: 'admin-login' };
  
  if (cleanPath.startsWith('/admin')) {
    const parts = cleanPath.split('/');
    const sub = parts[2] as AdminSubView;
    const allowedSubViews: AdminSubView[] = [
      'dashboard', 'products', 'products-new', 'products-edit', 'import',
      'categories', 'collections', 'inventory', 'orders', 'homepage', 'settings', 'coupons', 'saree-types'
    ];
    if (sub && allowedSubViews.includes(sub)) {
      return { type: 'admin', subView: sub };
    }
    return { type: 'admin', subView: 'dashboard' };
  }
  
  if (cleanPath.startsWith('/collection/')) {
    const cat = cleanPath.split('/')[2];
    return { type: 'collection', category: cat as any };
  }
  
  if (cleanPath.startsWith('/product/')) {
    const slug = cleanPath.split('/')[2];
    return { type: 'product', slug };
  }
  
  if (cleanPath === '/sale') return { type: 'sale' };
  
  return { type: 'home' };
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageView>(() => getPageFromPath(window.location.pathname));
  const [products, setProducts] = useState<Product[]>(() => isSupabaseConfigured() ? [] : PRODUCTS);
  const [categories, setCategories] = useState<any[]>([]);

  // Customer Auth state
  const [customerUser, setCustomerUser] = useState<{ id: string; email: string; fullName: string } | null>(null);

  // Cart & Wishlist state
  const [cart, setCart] = useState<CartItem[]>(() => cartService.getGuestCart());
  const [wishlistIds, setWishlistIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('vk_wishlist');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistDrawerOpen, setIsWishlistDrawerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const { settings } = useSiteSettings();
  const storeName = settings?.storeName || 'VK VASTRAM';

  // Admin Auth state
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminSubView, setAdminSubView] = useState<AdminSubView>(() => {
    const init = getPageFromPath(window.location.pathname);
    return (init.type === 'admin' && init.subView) ? init.subView : 'dashboard';
  });
  const [adminSelectedProductId, setAdminSelectedProductId] = useState<string | undefined>(undefined);

  // Initial Data Fetch
  const reloadStoreData = useCallback(async () => {
    try {
      const [fetchedProducts, fetchedCategories] = await Promise.all([
        productService.getProducts(),
        productService.getCategories(),
      ]);
      if (fetchedProducts && fetchedProducts.length > 0) {
        setProducts(fetchedProducts);
      }
      if (fetchedCategories && fetchedCategories.length > 0) {
        setCategories(fetchedCategories);
      }
    } catch {
      // fallback preserved
    }
  }, []);

  // Sync Cart with active auth user
  const syncUserCart = useCallback(async (userId: string, isExplicitLogin = false) => {
    try {
      if (isExplicitLogin) {
        const items = await cartService.mergeGuestCartOnLogin(userId);
        setCart(items);
      } else {
        const items = await cartService.getUserCart(userId);
        setCart(items);
      }
    } catch {
      // preserve current state on error
    }
  }, []);

  // Check and listen for Supabase auth state changes
  useEffect(() => {
    reloadStoreData();

    if (isSupabaseConfigured()) {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session?.user) {
          const profile = await customerService.getProfile(session.user.id);
          const userObj = {
            id: session.user.id,
            email: session.user.email || '',
            fullName: profile?.fullName || session.user.user_metadata?.full_name || 'Valued Patron',
          };
          setCustomerUser(userObj);
          syncUserCart(session.user.id, false);
          if (session.user.email) {
            orderService.linkGuestOrders(session.user.id, session.user.email).catch(() => {});
          }

          // Check the authoritative database role directly. customerService.getProfile()
          // intentionally maps only customer-facing fields and therefore does not expose role.
          // Checking role on that mapped object made valid admin sessions appear logged out after refresh.
          const { data: adminProfile, error: adminProfileError } = await (supabase as any)
            .from('profiles')
            .select('id, role, full_name, email')
            .eq('id', session.user.id)
            .maybeSingle();
          if (!adminProfileError && adminProfile?.role === 'admin') {
            setAdminUser({
              id: session.user.id,
              email: adminProfile.email || session.user.email || '',
              fullName: adminProfile.full_name || profile?.fullName || 'Administrator',
              role: 'admin',
            });
            // Restore the requested admin route after the persisted Supabase session
            // and database-backed admin role have both been verified.
            const requestedPage = getPageFromPath(window.location.pathname);
            if (requestedPage.type === 'admin' || requestedPage.type === 'admin-login') {
              setCurrentPage({ type: 'admin', subView: requestedPage.type === 'admin' ? (requestedPage.subView || 'dashboard') : 'dashboard' });
            }
          }
        }
      });

      const { data: authListener } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (session?.user) {
            const profile = await customerService.getProfile(session.user.id);
            setCustomerUser({
              id: session.user.id,
              email: session.user.email || '',
              fullName: profile?.fullName || session.user.user_metadata?.full_name || 'Valued Patron',
            });
            // Keep admin state synchronized when Supabase restores or refreshes a session.
            const { data: roleProfile } = await (supabase as any)
              .from('profiles').select('id, role, full_name, email')
              .eq('id', session.user.id).maybeSingle();
            if (roleProfile?.role === 'admin') {
              setAdminUser({ id: session.user.id, email: roleProfile.email || session.user.email || '', fullName: roleProfile.full_name || profile?.fullName || 'Administrator', role: 'admin' });
              const requestedPage = getPageFromPath(window.location.pathname);
              if (requestedPage.type === 'admin' || requestedPage.type === 'admin-login') {
                setCurrentPage({ type: 'admin', subView: requestedPage.type === 'admin' ? (requestedPage.subView || 'dashboard') : 'dashboard' });
              }
            } else if (event === 'SIGNED_OUT') {
              setAdminUser(null);
            }
            const isLoginEvent = event === 'SIGNED_IN';
            syncUserCart(session.user.id, isLoginEvent);
          } else if (event === 'SIGNED_OUT') {
            setCustomerUser(null);
            setCart(cartService.getGuestCart());
          }
        }
      );

      return () => {
        authListener.subscription.unsubscribe();
      };
    } else {
      const localCustomer = localStorage.getItem('vk_local_customer');
      if (localCustomer) {
        try {
          const parsed = JSON.parse(localCustomer);
          setCustomerUser(parsed);
        } catch {
          // ignore
        }
      }
    }
  }, [reloadStoreData, syncUserCart]);

  // Wishlist persistence
  useEffect(() => {
    try {
      localStorage.setItem('vk_wishlist', JSON.stringify(wishlistIds));
    } catch {
      // ignore
    }
  }, [wishlistIds]);

  // Configure manual scroll restoration to prevent footer anchor stickiness
  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  // Sync browser back/forward buttons with App page state
  useEffect(() => {
    const handlePopState = () => {
      const page = getPageFromPath(window.location.pathname);
      setCurrentPage(page);
      if (page.type === 'admin' && page.subView) {
        setAdminSubView(page.subView);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Recalculate GSAP ScrollTrigger positions and scroll top on page transitions
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    
    // Backup requestAnimationFrame to ensure scroll top after DOM repaint
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });

    const timer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 60);
    return () => clearTimeout(timer);
  }, [currentPage]);

  // Navigation dispatcher
  const handleNavigate = (page: PageView) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });

    if (page.type === 'admin') {
      if (page.subView) setAdminSubView(page.subView);
      if (page.productId) setAdminSelectedProductId(page.productId);
    }

    // Sync URL in browser address bar without hard reloading
    const newPath = getPathFromPage(page);
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
  };

  // Wishlist toggle handler
  const handleToggleWishlist = (product: Product) => {
    setWishlistIds((prev) =>
      prev.includes(product.id)
        ? prev.filter((id) => id !== product.id)
        : [...prev, product.id]
    );
  };

  // Unified Cart Actions
  const handleAddToCart = async (
    product: Product,
    quantity = 1,
    selectedColor?: string,
    selectedSize?: string,
    variantId?: string
  ) => {
    const validAddQty = sanitizeQuantity(quantity, product.stockQuantity || MAX_CART_ITEM_QUANTITY);

    if (customerUser) {
      console.log(`[CART_MUTATION] source=handleAddToCart (auth) userId=${customerUser.id} product=${product.id} qty=${validAddQty}`);
      try {
        await cartService.addItemToUserCart(
          customerUser.id,
          product.id,
          variantId || (product.variants?.length === 1 ? product.variants[0].id : undefined),
          validAddQty,
          selectedColor,
          selectedSize
        );
        const updated = await cartService.getUserCart(customerUser.id);
        setCart(updated);
      } catch (err) {
        console.warn('User cart addition error:', err);
      }
    } else {
      console.log(`[CART_MUTATION] source=handleAddToCart (guest) product=${product.id} qty=${validAddQty}`);
      setCart((prev) => {
        const resolvedVariantId = variantId || product.variants?.find((v) => v.isActive !== false && Number(v.availableQuantity ?? v.stockQuantity ?? 0) > 0)?.id || (product.variants?.length === 1 ? product.variants[0].id : undefined);
        const itemKey = `guest-${product.id}-${resolvedVariantId || selectedColor || 'default'}-${selectedSize || 'default'}`;
        const existing = prev.find(
          (item) =>
            item.id === itemKey ||
            ((item.product.id === product.id || item.product.slug === product.slug) &&
              (item.variantId || '') === (resolvedVariantId || '') &&
              (item.selectedColor || '') === (selectedColor || '') &&
              (item.selectedSize || '') === (selectedSize || ''))
        );
        let updated: CartItem[];
        if (existing) {
          const currentQty = Number(existing.quantity) || 1;
          const newQty = sanitizeQuantity(currentQty + validAddQty, existing.stockAvailable || product.stockQuantity);
          updated = prev.map((item) =>
            item === existing
              ? { ...item, quantity: newQty }
              : item
          );
        } else {
          updated = [
            ...prev,
            {
              id: itemKey,
              variantId: resolvedVariantId,
              product,
              quantity: validAddQty,
              selectedColor: selectedColor || (product.colors ? product.colors[0] : undefined),
              selectedSize: selectedSize || (product.sizes ? product.sizes[0] : undefined),
              stockAvailable: product.stockQuantity ?? MAX_CART_ITEM_QUANTITY,
            },
          ];
        }
        cartService.saveGuestCart(updated);
        return updated;
      });
    }
  };

  const handleBuyNow = async (
    product: Product,
    quantity = 1,
    selectedColor?: string,
    selectedSize?: string,
    variantId?: string
  ) => {
    await handleAddToCart(product, quantity, selectedColor, selectedSize, variantId);
    setIsCartOpen(false);
    handleNavigate({ type: 'checkout' });
  };

  const handleUpdateCartQuantity = async (
    productId: string,
    quantity: number,
    cartItemId?: string
  ) => {
    const sanitizedVal = quantity <= 0 ? 0 : sanitizeQuantity(quantity);

    if (customerUser && cartItemId) {
      await cartService.updateItemQuantity(customerUser.id, cartItemId, sanitizedVal);
      const updated = await cartService.getUserCart(customerUser.id);
      setCart(updated);
    } else {
      setCart((prev) => {
        let updated: CartItem[];
        if (sanitizedVal <= 0) {
          updated = prev.filter((item) => (cartItemId ? item.id !== cartItemId : item.product.id !== productId));
        } else {
          updated = prev.map((item) =>
            (cartItemId ? item.id === cartItemId : item.product.id === productId)
              ? { ...item, quantity: sanitizedVal }
              : item
          );
        }
        cartService.saveGuestCart(updated);
        return updated;
      });
    }
  };

  const handleRemoveCartItem = async (productId: string, cartItemId?: string) => {
    if (customerUser && cartItemId) {
      await cartService.removeItemFromUserCart(customerUser.id, cartItemId);
      const updated = await cartService.getUserCart(customerUser.id);
      setCart(updated);
    } else {
      setCart((prev) => {
        const updated = prev.filter((item) => (cartItemId ? item.id !== cartItemId : item.product.id !== productId));
        cartService.saveGuestCart(updated);
        return updated;
      });
    }
  };

  // Customer Auth Handlers
  const handleCustomerLoginSuccess = (userId: string, email: string) => {
    const userObj = { id: userId, email, fullName: email.split('@')[0] };
    setCustomerUser(userObj);
    localStorage.setItem('vk_local_customer', JSON.stringify(userObj));
    syncUserCart(userId, true);
    orderService.linkGuestOrders(userId, email).catch(() => {});
  };

  const handleCustomerLogout = async () => {
    localStorage.removeItem('vk_local_customer');
    if (isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
    }
    setCustomerUser(null);
    setCart([]);
    cartService.clearGuestCart();
    setCurrentPage({ type: 'home' });
  };

  const handleOrderSuccess = (
    orderId: string,
    orderNumber: string,
    options?: { paymentVerified?: boolean; paymentMethod?: 'online' | 'cod'; guestAccessToken?: string }
  ) => {
    // Order success callback is invoked only after the order/payment flow confirms success.
    setCart([]);
    cartService.clearGuestCart();
    handleNavigate({
      type: 'order-confirmation',
      orderId,
      orderNumber,
      paymentVerified: options?.paymentVerified,
      paymentMethod: options?.paymentMethod,
      guestAccessToken: options?.guestAccessToken,
    });
  };

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const wishlistedProducts = products.filter((p) => wishlistIds.includes(p.id));

  // Category partitions
  const activeProducts = products.filter((p) => p.status !== 'draft' && p.status !== 'archived');
  const featuredSarees = activeProducts.filter((p) => p.category === 'sarees').slice(0, 3);
  const featuredBedsheets = activeProducts.filter((p) => p.category === 'bedsheets').slice(0, 3);

  // ==========================================
  // ADMIN VIEW ROUTER
  // ==========================================
  if (currentPage.type === 'admin-login') {
    return (
      <AdminLogin
        onSuccess={(user) => {
          setAdminUser(user);
          setCurrentPage({ type: 'admin', subView: adminSubView || 'dashboard' });
          // Ensure URL syncs on login success
          const newPath = `/admin/${adminSubView || 'dashboard'}`;
          if (window.location.pathname !== newPath) {
            window.history.pushState(null, '', newPath);
          }
        }}
        onBackToStore={() => setCurrentPage({ type: 'home' })}
      />
    );
  }

  if (currentPage.type === 'admin') {
    if (!adminUser || adminUser.role !== 'admin') {
      return (
        <AdminLogin
          onSuccess={(user) => {
            setAdminUser(user);
            setCurrentPage({ type: 'admin', subView: adminSubView || 'dashboard' });
            // Ensure URL syncs on login success
            const newPath = `/admin/${adminSubView || 'dashboard'}`;
            if (window.location.pathname !== newPath) {
              window.history.pushState(null, '', newPath);
            }
          }}
          onBackToStore={() => setCurrentPage({ type: 'home' })}
        />
      );
    }

    return (
      <AdminLayout
        currentSubView={adminSubView}
        onNavigateSubView={(view, pId) => {
          setAdminSubView(view);
          setAdminSelectedProductId(pId);
          // Sync URL path as they navigate between admin CMS subviews
          const newPath = `/admin/${view}`;
          if (window.location.pathname !== newPath) {
            window.history.pushState(null, '', newPath);
          }
        }}
        onNavigateStorefront={(page) => {
          reloadStoreData();
          handleNavigate(page);
        }}
        user={adminUser}
        onLogout={async () => {
          await authService.signOut();
          setAdminUser(null);
          setCurrentPage({ type: 'home' });
          // Ensure URL is reset to home on logout
          if (window.location.pathname !== '/') {
            window.history.pushState(null, '', '/');
          }
        }}
      >
        {adminSubView === 'dashboard' && (
          <AdminDashboard
            onNavigateSubView={(view, pId) => {
              setAdminSubView(view);
              setAdminSelectedProductId(pId);
            }}
          />
        )}
        {adminSubView === 'orders' && <AdminOrders />}
        {adminSubView === 'products' && (
          <AdminProductsList
            onNavigateSubView={(view, pId) => {
              setAdminSubView(view);
              setAdminSelectedProductId(pId);
            }}
            onNavigateStorefront={handleNavigate}
          />
        )}
        {adminSubView === 'products-new' && (
          <AdminProductForm
            onNavigateSubView={(view) => {
              reloadStoreData();
              setAdminSubView(view);
            }}
          />
        )}
        {adminSubView === 'products-edit' && (
          <AdminProductForm
            productId={adminSelectedProductId}
            onNavigateSubView={(view) => {
              reloadStoreData();
              setAdminSubView(view);
            }}
          />
        )}
        {adminSubView === 'import' && <AdminImport />}
        {adminSubView === 'categories' && <AdminCategories />}
        {adminSubView === 'collections' && <AdminCollections />}
        {adminSubView === 'inventory' && <AdminInventory />}
        {adminSubView === 'homepage' && <AdminHomepage />}
        {adminSubView === 'settings' && <AdminSettings />}
        {adminSubView === 'coupons' && <AdminCoupons />}
        {adminSubView === 'saree-types' && <AdminSareeTypes />}
      </AdminLayout>
    );
  }

  // ==========================================
  // CUSTOMER STOREFRONT ROUTER
  // ==========================================
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#1C1917] selection:bg-[#B88E3E]/20">
      {/* 1. Slim Announcement Bar */}
      <AnnouncementBar />

      {/* 2. Top Header Navigation */}
      <Header
        currentPage={currentPage}
        onNavigate={handleNavigate}
        cartCount={totalCartCount}
        wishlistCount={wishlistIds.length}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        isCustomerLoggedIn={Boolean(customerUser)}
        customerName={customerUser?.fullName}
        categories={categories}
      />

      {/* 3. Main Dynamic Content View */}
      <main
        key={currentPage.type + ('category' in currentPage ? String(currentPage.category) : '') + ('slug' in currentPage ? String(currentPage.slug) : '')}
        className="flex-1 animate-page-enter"
      >
        {/* CHECKOUT & ORDER CONFIRMATION */}
        {currentPage.type === 'checkout' && (
          <CheckoutPage
            items={cart}
            userId={customerUser?.id}
            userEmail={customerUser?.email}
            onNavigate={handleNavigate}
            onOrderSuccess={handleOrderSuccess}
          />
        )}

        {currentPage.type === 'order-confirmation' && (
          <OrderConfirmationPage
            orderId={currentPage.orderId}
            orderNumber={currentPage.orderNumber}
            paymentVerified={currentPage.paymentVerified}
            paymentMethod={currentPage.paymentMethod}
            guestAccessToken={currentPage.guestAccessToken}
            onNavigate={handleNavigate}
          />
        )}

        {/* CUSTOMER AUTH & ACCOUNT ROUTES */}
        {currentPage.type === 'login' && (
          <CustomerLogin
            onSuccess={handleCustomerLoginSuccess}
            onNavigate={handleNavigate}
            redirectAfter={currentPage.redirectAfter}
          />
        )}

        {currentPage.type === 'register' && (
          <CustomerRegister
            onSuccess={handleCustomerLoginSuccess}
            onNavigate={handleNavigate}
            redirectAfter={currentPage.redirectAfter}
          />
        )}

        {currentPage.type === 'forgot-password' && (
          <ForgotPassword onNavigate={handleNavigate} />
        )}

        {currentPage.type === 'reset-password' && (
          <ResetPassword onNavigate={handleNavigate} />
        )}

        {currentPage.type === 'account' && (
          customerUser ? (
            <AccountPage
              userId={customerUser.id}
              userEmail={customerUser.email}
              initialTab={currentPage.tab || 'profile'}
              wishlistedProducts={wishlistedProducts}
              onNavigate={handleNavigate}
              onLogout={handleCustomerLogout}
            />
          ) : (
            <CustomerLogin
              onSuccess={handleCustomerLoginSuccess}
              onNavigate={handleNavigate}
              redirectAfter={{ type: 'account' }}
            />
          )
        )}

        {/* FULL CART PAGE */}
        {currentPage.type === 'cart' && (
          <CartPage
            items={cart}
            onUpdateQuantity={handleUpdateCartQuantity}
            onRemoveItem={handleRemoveCartItem}
            onNavigate={handleNavigate}
            onCheckout={() => handleNavigate({ type: 'checkout' })}
          />
        )}

        {/* CATALOG & EDITORIAL PAGES */}
        {currentPage.type === 'home' && (
          <div className="space-y-0">
            <HeroSection onNavigate={handleNavigate} />
            <CategoryShowcase categories={categories} onNavigate={handleNavigate} />

            {/* Featured Sarees */}
            <section className="py-16 sm:py-20 bg-[#FAF8F5]">
              <Container>
                <ScrollReveal distance={16} duration={550}>
                  <SectionHeading
                    kicker="Handloom Masterpieces"
                    title="Curated Heritage Sarees"
                    subtitle="Handwoven pure katan silks, Banarasi brocades, and ceremonial temple drapes."
                    action={
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleNavigate({ type: 'collection', category: 'sarees' })}
                        rightIcon={<ArrowRight className="w-4 h-4" />}
                      >
                        View All Sarees
                      </Button>
                    }
                  />
                </ScrollReveal>

                <ProductGrid
                  products={featuredSarees}
                  wishlistIds={wishlistIds}
                  columns={4}
                  onToggleWishlist={handleToggleWishlist}
                  onSelectProduct={(slug) => handleNavigate({ type: 'product', slug })}
                  onQuickView={(p) => setQuickViewProduct(p)}
                  onAddToCart={(p) => handleAddToCart(p, 1)}
                />
              </Container>
            </section>

            <CraftsmanshipStory onNavigate={handleNavigate} />

            {/* Curated Bedsheets */}
            <section className="py-16 sm:py-20 bg-[#FAF8F5]">
              <Container>
                <ScrollReveal distance={16} duration={550}>
                  <SectionHeading
                    kicker="Artisanal Bedding"
                    title="Pure Cotton Bedsheet Sets"
                    subtitle="Breathable long-staple cottons and natural hand-block prints crafted for restful spaces."
                    action={
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleNavigate({ type: 'collection', category: 'bedsheets' })}
                        rightIcon={<ArrowRight className="w-4 h-4" />}
                      >
                        View All Bedsheets
                      </Button>
                    }
                  />
                </ScrollReveal>

                <ProductGrid
                  products={featuredBedsheets}
                  wishlistIds={wishlistIds}
                  columns={4}
                  onToggleWishlist={handleToggleWishlist}
                  onSelectProduct={(slug) => handleNavigate({ type: 'product', slug })}
                  onQuickView={(p) => setQuickViewProduct(p)}
                  onAddToCart={(p) => handleAddToCart(p, 1)}
                />
              </Container>
            </section>

            {/* Recently Viewed Rail (Homepage Discovery) */}
            {recentlyViewedService.getRecentlyViewed(products).length > 0 && (
              <HorizontalProductRail
                title="Recently Viewed"
                products={recentlyViewedService.getRecentlyViewed(products)}
                wishlistIds={wishlistIds}
                onSelectProduct={(slug) => handleNavigate({ type: 'product', slug })}
                onToggleWishlist={handleToggleWishlist}
                onQuickView={(p) => setQuickViewProduct(p)}
                onAddToCart={(p) => handleAddToCart(p, 1)}
                className="bg-[#FAF8F5] border-t border-[#1C1917]/10"
              />
            )}

            <TrustGuarantees />
          </div>
        )}

        {currentPage.type === 'collection' && (
          <CollectionPage
            category={currentPage.category}
            subCategoryFilter={currentPage.subCategory}
            onNavigate={handleNavigate}
            wishlistIds={wishlistIds}
            onToggleWishlist={handleToggleWishlist}
            onQuickView={(p) => setQuickViewProduct(p)}
            onAddToCart={(p) => handleAddToCart(p, 1)}
            products={products}
            categories={categories}
          />
        )}

        {currentPage.type === 'product' && (
          <ProductDetailPage
            slug={currentPage.slug}
            products={products}
            onNavigate={handleNavigate}
            isWishlisted={wishlistIds.includes(
              products.find((p) => p.slug === currentPage.slug)?.id || ''
            )}
            onToggleWishlist={handleToggleWishlist}
            onAddToCart={handleAddToCart}
            onBuyNow={handleBuyNow}
          />
        )}

        {currentPage.type === 'sale' && (
          <SalePage
            onNavigate={handleNavigate}
            wishlistIds={wishlistIds}
            onToggleWishlist={handleToggleWishlist}
            onQuickView={(p) => setQuickViewProduct(p)}
            onAddToCart={(p) => handleAddToCart(p, 1)}
            products={products}
          />
        )}

        {currentPage.type === 'about' && (
          <AboutPage onNavigate={handleNavigate} />
        )}

        {currentPage.type === 'faq' && (
          <FaqPage onNavigate={handleNavigate} />
        )}

        {currentPage.type === 'contact' && (
          <ContactPage onNavigate={handleNavigate} />
        )}

        {currentPage.type === 'wishlist' && (
          <WishlistPage
            products={wishlistedProducts}
            onNavigate={handleNavigate}
            onRemoveFromWishlist={(id) =>
              setWishlistIds((prev) => prev.filter((itemId) => itemId !== id))
            }
            onQuickView={(p) => setQuickViewProduct(p)}
            onAddToCart={(p) => handleAddToCart(p, 1)}
          />
        )}
      </main>

      {/* 4. Editorial Footer */}
      <Footer categories={categories} onNavigate={handleNavigate} />

      {/* Admin Access Anchor Button */}
      <div className="bg-[#171412] py-2 px-4 text-center border-t border-[#2E2926] text-[11px] text-[#78716C] flex items-center justify-center gap-4">
        <span>{storeName} Storefront Portal</span>
        <span>·</span>
        <button
          onClick={() => handleNavigate({ type: 'admin-login' })}
          className="text-[#967029] hover:text-[#FAF8F5] transition-colors cursor-pointer font-medium"
        >
          Merchant Administration CMS →
        </button>
      </div>

      {/* Quick View Modal */}
      <ProductDetailModal
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        isWishlisted={quickViewProduct ? wishlistIds.includes(quickViewProduct.id) : false}
        onToggleWishlist={handleToggleWishlist}
        onAddToCart={(product, qty, color, size, variantId) => {
          handleAddToCart(product, qty, color, size, variantId);
          setIsCartOpen(true);
        }}
      />

      {/* Slide-Over Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onCheckout={() => {
          setIsCartOpen(false);
          handleNavigate({ type: 'checkout' });
        }}
        onViewFullCart={() => {
          setIsCartOpen(false);
          handleNavigate({ type: 'cart' });
        }}
        onNavigateToProduct={(slug) => handleNavigate({ type: 'product', slug })}
      />

      {/* Wishlist Drawer */}
      <WishlistDrawer
        isOpen={isWishlistDrawerOpen}
        onClose={() => setIsWishlistDrawerOpen(false)}
        products={wishlistedProducts}
        onRemoveFromWishlist={(id) =>
          setWishlistIds((prev) => prev.filter((itemId) => itemId !== id))
        }
        onAddToCart={(product) => {
          handleAddToCart(product, 1);
          setIsWishlistDrawerOpen(false);
          setIsCartOpen(true);
        }}
        onQuickView={(p) => setQuickViewProduct(p)}
      />

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        products={products}
        onSelectProduct={(slug) => {
          handleNavigate({ type: 'product', slug });
        }}
      />
    </div>
  );
}
