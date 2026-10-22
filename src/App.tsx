import { useState, useEffect, useCallback, useRef } from 'react';
import { overlayHistory } from './lib/overlayHistory';
import { AnnouncementBar } from './components/common/AnnouncementBar';
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { HeroSection } from './components/home/HeroSection';
import { CategoryShowcase } from './components/home/CategoryShowcase';
import { CraftsmanshipStory } from './components/home/CraftsmanshipStory';
import { BudgetDiscovery } from './components/home/BudgetDiscovery';
import { SareeTraditions } from './components/home/SareeTraditions';
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
import { TrackOrderPage } from './components/pages/TrackOrderPage';
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
import { ScrollProgress } from './components/ui/ScrollProgress';
import { Button } from './components/ui/Button';
import { BagWaveTransition } from './components/ui/BagWaveTransition';
import { ScrollTrigger } from './lib/gsap';
import { productService } from './services/productService';
import { authService, AdminUser } from './services/authService';
import { cartService } from './services/cartService';
import { orderService } from './services/orderService';
import { customerService } from './services/customerService';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { Product, PageView, CartItem, AdminSubView } from './types';
import { ArrowRight } from 'lucide-react';
import { useSiteSettings } from './hooks/useSiteSettings';
import { adminService, HomepageSectionData, CollectionAdminData } from './services/adminService';

import { sanitizeQuantity, MAX_CART_ITEM_QUANTITY } from './lib/validation';
import { resolveVariantCartImage } from './lib/cartVariantImage';
import { MostLovedStyles } from './components/home/MostLovedStyles';

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
    case 'track-order': return '/track-order';
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
    case 'collection': {
      if (page.collectionSlug) return `/collections/${encodeURIComponent(page.collectionSlug)}`;
      const params = new URLSearchParams();
      if (page.priceMin !== undefined) params.set('minPrice', String(page.priceMin));
      if (page.priceMax !== undefined) params.set('maxPrice', String(page.priceMax));
      if (page.subCategory) params.set('subCategory', page.subCategory);
      const query = params.toString();
      return `/collection/${page.category}${query ? `?${query}` : ''}`;
    }
    case 'product': return `/product/${page.slug}`;
    case 'sale': return '/sale';
    default: return '/';
  }
};

const getPageFromPath = (path: string, search = ''): PageView => {
  const cleanPath = path.toLowerCase().trim().replace(/\/$/, '');
  const query = new URLSearchParams(search);
  if (!cleanPath || cleanPath === '') return { type: 'home' };
  if (cleanPath === '/about') return { type: 'about' };
  if (cleanPath === '/faq') return { type: 'faq' };
  if (cleanPath === '/contact') return { type: 'contact' };
  if (cleanPath === '/wishlist') return { type: 'wishlist' };
  if (cleanPath === '/cart') return { type: 'cart' };
  if (cleanPath === '/checkout') return { type: 'checkout' };
  if (cleanPath === '/track-order') return { type: 'track-order' };
  if (cleanPath === '/login') return { type: 'login' };
  if (cleanPath === '/register') return { type: 'register' };
  if (cleanPath === '/forgot-password') return { type: 'forgot-password' };
  if (cleanPath === '/reset-password') return { type: 'reset-password' };
  if (cleanPath === '/account') return { type: 'account' };
  if (cleanPath === '/admin') return { type: 'admin-login' };
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
  
  if (cleanPath.startsWith('/collections/')) {
    const slug = cleanPath.split('/')[2];
    return slug ? { type: 'collection', category: 'all', collectionSlug: decodeURIComponent(slug) } : { type: 'home' };
  }
  if (cleanPath.startsWith('/collection/')) {
    const cat = cleanPath.split('/')[2];
    const min = Number(query.get('minPrice'));
    const max = Number(query.get('maxPrice'));
    return {
      type: 'collection',
      category: cat as any,
      ...(query.has('minPrice') && Number.isFinite(min) ? { priceMin: min } : {}),
      ...(query.has('maxPrice') && Number.isFinite(max) ? { priceMax: max } : {}),
      ...(query.has('subCategory') && query.get('subCategory') ? { subCategory: query.get('subCategory')! } : {}),
    };
  }
  
  if (cleanPath.startsWith('/product/')) {
    const slug = cleanPath.split('/')[2];
    return { type: 'product', slug };
  }
  
  if (cleanPath === '/sale') return { type: 'sale' };
  
  return { type: 'home' };
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageView>(() => getPageFromPath(window.location.pathname, window.location.search));
  const [products, setProducts] = useState<Product[]>([]);
  // false until the first product fetch has finished (success or failure). Prevents the
  // "Coming soon" message from flashing on refresh before products arrive.
  const [productsLoaded, setProductsLoaded] = useState(false);
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
  const [bagWaveKey, setBagWaveKey] = useState(0);

  const { settings } = useSiteSettings();
  const storeName = settings?.storeName || 'VK VASTRAM';
  const [homepageSections, setHomepageSections] = useState<HomepageSectionData[] | null>(() => adminService.getCachedHomepageSections());
  const [cmsCollections, setCmsCollections] = useState<CollectionAdminData[]>([]);
  const [cmsCollectionsLoaded, setCmsCollectionsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    const refreshHomepageSections = async () => {
      const sections = await adminService.getHomepageSections();
      if (mounted) setHomepageSections(sections);
    };
    const refreshCollections = async () => {
      const collections = await adminService.getCollections();
      if (mounted) {
        // Keep active and archived rows locally: storefront modules need to respect
        // archive state rather than treating an archived collection as non-existent.
        setCmsCollections(collections);
        setCmsCollectionsLoaded(true);
      }
    };
    void refreshHomepageSections();
    void refreshCollections();
    window.addEventListener('vk_homepage_updated', refreshHomepageSections);
    window.addEventListener('vk_collections_updated', refreshCollections);
    // Refresh after returning from another tab/device workflow so archived/active
    // CMS content cannot remain stale until a full reload.
    window.addEventListener('focus', refreshHomepageSections);
    window.addEventListener('focus', refreshCollections);
    window.addEventListener('storage', refreshHomepageSections);
    window.addEventListener('storage', refreshCollections);
    return () => {
      mounted = false;
      window.removeEventListener('vk_homepage_updated', refreshHomepageSections);
      window.removeEventListener('vk_collections_updated', refreshCollections);
      window.removeEventListener('focus', refreshHomepageSections);
      window.removeEventListener('focus', refreshCollections);
      window.removeEventListener('storage', refreshHomepageSections);
      window.removeEventListener('storage', refreshCollections);
    };
  }, []);

  const isHomepageSectionActive = (sectionType: string) => {
    // Avoid briefly flashing the Philosophy block before the saved CMS visibility has loaded.
    if (!homepageSections) return !isSupabaseConfigured();
    const section = homepageSections.find((item) => item.sectionType?.toLowerCase() === sectionType.toLowerCase());
    // When Supabase is configured, CMS is authoritative: missing/inactive rows must not
    // silently re-enable a section that the administrator has disabled.
    return Boolean(section && section.isActive !== false);
  };

  // Admin Auth state
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminSubView, setAdminSubView] = useState<AdminSubView>(() => {
    const init = getPageFromPath(window.location.pathname, window.location.search);
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
    } finally {
      setProductsLoaded(true);
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
            const requestedPage = getPageFromPath(window.location.pathname, window.location.search);
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
              const requestedPage = getPageFromPath(window.location.pathname, window.location.search);
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

  // Scroll position memory: each history entry remembers how far down the page the user was,
  // so Back returns to the same product section instead of the top of the page.
  const pendingScrollRestoreRef = useRef<number | null>(null);

  // Configure manual scroll restoration to prevent footer anchor stickiness
  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  // Sync browser back/forward buttons with App page state
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // Back pressed while an overlay (e.g. fullscreen product image) is open: close the
      // overlay only. Do not change page and do not touch the scroll position.
      if (overlayHistory.handlePopState()) return;

      // Returning to an earlier page: restore the scroll position saved when the user left it.
      const savedY = (event.state && typeof event.state.vkScrollY === 'number') ? event.state.vkScrollY : null;
      pendingScrollRestoreRef.current = savedY;

      const page = getPageFromPath(window.location.pathname, window.location.search);
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
    const restoreY = pendingScrollRestoreRef.current;
    pendingScrollRestoreRef.current = null;

    if (restoreY !== null && restoreY > 0) {
      // Back/forward: return to the saved position. The page content may still be rendering,
      // so retry for a short while until the position can actually be reached.
      let attempts = 0;
      const step = () => {
        window.scrollTo({ top: restoreY, left: 0, behavior: 'instant' as ScrollBehavior });
        attempts += 1;
        if (Math.abs(window.scrollY - restoreY) > 4 && attempts < 40) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });

      // Backup requestAnimationFrame to ensure scroll top after DOM repaint
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
    }

    const timer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 60);
    return () => clearTimeout(timer);
  }, [currentPage]);

  // Navigation dispatcher
  const handleNavigate = (page: PageView) => {
    // Capture the scroll position BEFORE scrolling to top for the new page.
    const scrollBeforeNavigate = window.scrollY;
    pendingScrollRestoreRef.current = null;
    setCurrentPage(page);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });

    if (page.type === 'admin') {
      if (page.subView) setAdminSubView(page.subView);
      if (page.productId) setAdminSelectedProductId(page.productId);
    }

    // Sync URL in browser address bar without hard reloading
    const newPath = getPathFromPage(page);
    if (`${window.location.pathname}${window.location.search}` !== newPath) {
      // Remember where the user was on the page they are leaving (so Back can return there),
      // then add the new entry (it starts at the top).
      try {
        window.history.replaceState({ ...(window.history.state || {}), vkScrollY: scrollBeforeNavigate }, '');
      } catch {
        // ignore
      }
      window.history.pushState({ vkScrollY: 0, vkFrom: currentPage.type }, '', newPath);
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
    variantId?: string,
    includeFallPico = false,
    animateBag = true
  ): Promise<boolean> => {
    const validAddQty = sanitizeQuantity(quantity, product.stockQuantity || MAX_CART_ITEM_QUANTITY);
    // Resolve the variant once, then preserve its image together with its color
    // selection. The cart should never infer the thumbnail from product.primaryImage
    // because that may belong to the product's default/first color.
    const resolvedVariantId = variantId ||
      product.variants?.find((variant) => selectedColor && variant.color?.trim().toLowerCase() === selectedColor.trim().toLowerCase())?.id ||
      product.variants?.find((variant) => variant.isActive !== false && Number(variant.availableQuantity ?? variant.stockQuantity ?? 0) > 0)?.id ||
      (product.variants?.length === 1 ? product.variants[0].id : undefined);
    const resolvedVariant = product.variants?.find((variant) => variant.id === resolvedVariantId);
    // The variant ID is the source of truth. Never let a stale/missing color
    // label disagree with the actual SKU that will be reserved at checkout.
    const resolvedSelectedColor = resolvedVariant?.color || selectedColor || product.colors?.[0];
    const resolvedSelectedSize = selectedSize || resolvedVariant?.size || resolvedVariant?.bedSize || resolvedVariant?.dimensions || product.sizes?.[0];
    const selectedVariantImage = resolveVariantCartImage(product, resolvedVariantId, resolvedSelectedColor);

    // Start the visual response immediately on the user's tap, rather than waiting
    // for the authenticated cart API and follow-up cart refresh to finish.
    if (animateBag) setBagWaveKey((current) => current + 1);

    if (customerUser) {
      console.log(`[CART_MUTATION] source=handleAddToCart (auth) userId=${customerUser.id} product=${product.id} qty=${validAddQty}`);
      try {
        await cartService.addItemToUserCart(
          customerUser.id,
          product.id,
          resolvedVariantId,
          validAddQty,
          resolvedSelectedColor,
          resolvedSelectedSize,
          includeFallPico
        );
        const updated = await cartService.getUserCart(customerUser.id);
        setCart(updated);
      } catch (err) {
        console.warn('User cart addition error:', err);
        if (animateBag) setBagWaveKey(0);
        return false;
      }
    } else {
      console.log(`[CART_MUTATION] source=handleAddToCart (guest) product=${product.id} qty=${validAddQty}`);
      setCart((prev) => {
        const itemKey = `guest-${product.id}-${resolvedVariantId || resolvedSelectedColor || 'default'}-${resolvedSelectedSize || 'default'}-${includeFallPico ? 'fallpico' : 'plain'}`;
        const existing = prev.find(
          (item) =>
            item.id === itemKey ||
            ((item.product.id === product.id || item.product.slug === product.slug) &&
              (item.variantId || '') === (resolvedVariantId || '') &&
              (item.selectedColor || '') === (resolvedSelectedColor || '') &&
              (item.selectedSize || '') === (resolvedSelectedSize || '') &&
              Boolean(item.includeFallPico) === Boolean(includeFallPico))
        );
        let updated: CartItem[];
        if (existing) {
          const currentQty = Number(existing.quantity) || 1;
          const newQty = sanitizeQuantity(currentQty + validAddQty, existing.stockAvailable || product.stockQuantity);
          updated = prev.map((item) =>
            item === existing
              ? {
                  ...item,
                  quantity: newQty,
                  selectedColor: resolvedSelectedColor,
                  selectedSize: resolvedSelectedSize || item.selectedSize,
                  selectedVariantImage,
                  product: { ...product, primaryImage: selectedVariantImage || product.primaryImage },
                }
              : item
          );
        } else {
          updated = [
            ...prev,
            {
              id: itemKey,
              variantId: resolvedVariantId,
              // Give each variant cart row its own product-image snapshot.
              product: { ...product, primaryImage: selectedVariantImage || product.primaryImage },
              quantity: validAddQty,
              selectedColor: resolvedSelectedColor,
              selectedVariantImage,
              selectedSize: resolvedSelectedSize,
              includeFallPico,
              stockAvailable: product.stockQuantity ?? MAX_CART_ITEM_QUANTITY,
            },
          ];
        }
        cartService.saveGuestCart(updated);
        return updated;
      });
    }

    return true;
  };

  const handleBuyNow = async (
    product: Product,
    quantity = 1,
    selectedColor?: string,
    selectedSize?: string,
    variantId?: string,
    includeFallPico = false
  ) => {
    const added = await handleAddToCart(product, quantity, selectedColor, selectedSize, variantId, includeFallPico, false);
    if (!added) return;
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
  // The curated editorial row must be driven by the admin's Featured flag;
  // category alone is not a curation rule and was causing every saree to appear.
  const featuredSarees = activeProducts
    .filter((p) => p.category === 'sarees' && p.featured === true)
    .sort((a: any, b: any) => new Date(b.createdAt || b.created_at || 0).getTime() - new Date(a.createdAt || a.created_at || 0).getTime())
    .slice(0, 4);
  const featuredBedsheets = activeProducts.filter((p) => p.category === 'bedsheets').slice(0, 3);
  const isSeasonalSaleCollection = (collection: CollectionAdminData) => {
    const slug = collection.slug?.trim().toLowerCase();
    const name = collection.name?.trim().toLowerCase();
    return slug === 'seasonal-archive' || slug === 'seasonal-sale' || name === 'seasonal sale';
  };
  const seasonalCollectionRecord = cmsCollections.find(isSeasonalSaleCollection);
  const activeSeasonalCollection = seasonalCollectionRecord?.isActive !== false ? seasonalCollectionRecord : undefined;
  const seasonalSaleProducts = activeSeasonalCollection
    ? activeProducts.filter((product) => product.collectionId === activeSeasonalCollection.id).slice(0, 4)
    : [];
  const artisanalBedsheetsCollection = cmsCollections.find((collection) => {
    const slug = collection.slug?.trim().toLowerCase();
    const name = collection.name?.trim().toLowerCase();
    return slug === 'artisanal-bedsheets' || name === 'artisanal bedsheets';
  });
  // If an admin has explicitly archived the CMS collection, do not keep showing
  // the hardcoded bedsheet showcase on the homepage.
  const showFeaturedBedsheets = !isSupabaseConfigured()
    ? true
    : cmsCollectionsLoaded
      ? !(artisanalBedsheetsCollection && artisanalBedsheetsCollection.isActive === false)
      : false;
  const saleNavigationPage: PageView | null = seasonalCollectionRecord
    ? (activeSeasonalCollection ? { type: 'collection', category: 'all', collectionSlug: activeSeasonalCollection.slug } : null)
    : { type: 'sale' };

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
          if (`${window.location.pathname}${window.location.search}` !== newPath) {
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
            if (`${window.location.pathname}${window.location.search}` !== newPath) {
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
          if (`${window.location.pathname}${window.location.search}` !== newPath) {
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
      <ScrollProgress />
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
        {currentPage.type === 'track-order' && <TrackOrderPage />}

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
            {isHomepageSectionActive('hero') && <HeroSection onNavigate={handleNavigate} />}
            {isHomepageSectionActive('categories') && <CategoryShowcase categories={categories} onNavigate={handleNavigate} />}

            {/* Most Loved Styles: a rotating selection of sarees, changes every 2 minutes. */}
            <MostLovedStyles
              products={activeProducts}
              wishlistIds={wishlistIds}
              onToggleWishlist={handleToggleWishlist}
              onSelectProduct={(slug) => handleNavigate({ type: 'product', slug })}
              onQuickView={(p) => setQuickViewProduct(p)}
              onAddToCart={(p, quantity, color, size, variantId) => handleAddToCart(p, quantity ?? 1, color, size, variantId)}
              onViewAll={() => handleNavigate({ type: 'collection', category: 'sarees' })}
            />

            <BudgetDiscovery products={activeProducts} onNavigate={handleNavigate} />
            <SareeTraditions products={activeProducts} onNavigate={handleNavigate} />

            {/* Active Seasonal Sale collection is a storefront feature, not just an admin record. */}
            {activeSeasonalCollection && (
              <section className="py-9 sm:py-16 bg-[#FAF8F5] border-t border-[#1C1917]/10">
                <Container>
                  <ScrollReveal distance={16} duration={550}>
                    <SectionHeading
                      kicker="Seasonal Edit"
                      title={activeSeasonalCollection.name}
                      subtitle={activeSeasonalCollection.description || 'A considered selection of limited seasonal pieces.'}
                      action={
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleNavigate({ type: 'collection', category: 'all', collectionSlug: activeSeasonalCollection.slug })}
                          rightIcon={<ArrowRight className="w-4 h-4" />}
                        >
                          Explore the Edit
                        </Button>
                      }
                    />
                  </ScrollReveal>
                  {seasonalSaleProducts.length > 0 ? (
                    <ProductGrid
                      products={seasonalSaleProducts}
                      wishlistIds={wishlistIds}
                      columns={4}
                      mobileCarousel
                      onToggleWishlist={handleToggleWishlist}
                      onSelectProduct={(slug) => handleNavigate({ type: 'product', slug })}
                      onQuickView={(product) => setQuickViewProduct(product)}
                      onAddToCart={(product, quantity, color, size, variantId) => handleAddToCart(product, quantity ?? 1, color, size, variantId)}
                    />
                  ) : (
                    <div className="border border-[#1C1917]/10 bg-[#F4EFE6]/45 px-5 py-8 text-center">
                      <p className="font-serif text-lg text-[#1C1917]">This seasonal edit is being curated.</p>
                      <p className="mt-2 text-sm text-[#78716C]">Please check back soon for the selected pieces.</p>
                    </div>
                  )}
                </Container>
              </section>
            )}

            {isHomepageSectionActive('philosophy') && <CraftsmanshipStory onNavigate={handleNavigate} />}

            {/* Curated Bedsheets — respects an explicit CMS archive state. */}
            {showFeaturedBedsheets && <section className="pt-9 pb-12 sm:py-20 bg-[#FAF8F5]">
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
                        className="vk-cta-blink"
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
                  onAddToCart={(p, quantity, color, size, variantId) => handleAddToCart(p, quantity ?? 1, color, size, variantId)}
                />
              </Container>
            </section>}

            {/* Recently Viewed Rail (Homepage Discovery) */}
            {recentlyViewedService.getRecentlyViewed(products).length > 0 && (
              <HorizontalProductRail
                title="Recently Viewed"
                products={recentlyViewedService.getRecentlyViewed(products)}
                wishlistIds={wishlistIds}
                onSelectProduct={(slug) => handleNavigate({ type: 'product', slug })}
                onToggleWishlist={handleToggleWishlist}
                onQuickView={(p) => setQuickViewProduct(p)}
                onAddToCart={(p, quantity, color, size, variantId) => handleAddToCart(p, quantity ?? 1, color, size, variantId)}
                className="bg-[#FAF8F5] border-t border-[#1C1917]/10"
              />
            )}

            <TrustGuarantees />
          </div>
        )}

        {currentPage.type === 'collection' && (() => {
          const cmsCollection = currentPage.collectionSlug
            ? cmsCollections.find((item) => item.slug.toLowerCase() === currentPage.collectionSlug!.toLowerCase() && item.isActive !== false)
            : undefined;
          return (
            <CollectionPage
              category={currentPage.collectionSlug ? 'all' : currentPage.category}
              collectionId={currentPage.collectionSlug ? (cmsCollection?.id || '__missing_cms_collection__') : undefined}
              collectionTitle={currentPage.collectionSlug ? (cmsCollection?.name || 'Collection unavailable') : undefined}
              collectionSubtitle={currentPage.collectionSlug ? (cmsCollection?.description || 'This curated collection is not available right now.') : undefined}
              collectionImageUrl={cmsCollection?.imageUrl}
              collectionBannerImageUrl={cmsCollection?.bannerImageUrl}
              subCategoryFilter={currentPage.subCategory}
              initialPriceMin={currentPage.priceMin}
              initialPriceMax={currentPage.priceMax}
              onNavigate={handleNavigate}
              wishlistIds={wishlistIds}
              onToggleWishlist={handleToggleWishlist}
              onQuickView={(p) => setQuickViewProduct(p)}
              onAddToCart={(p, quantity, color, size, variantId) => handleAddToCart(p, quantity ?? 1, color, size, variantId)}
              products={products}
              productsLoading={!productsLoaded}
              categories={categories}
            />
          );
        })()}

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
            onAddToCart={(p, quantity, color, size, variantId) => handleAddToCart(p, quantity ?? 1, color, size, variantId)}
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
            onAddToCart={(p, quantity, color, size, variantId) => handleAddToCart(p, quantity ?? 1, color, size, variantId)}
          />
        )}
      </main>

      {/* 4. Editorial Footer */}
      <Footer categories={categories} onNavigate={handleNavigate} saleNavigationPage={saleNavigationPage} />


      {bagWaveKey > 0 && (
        <BagWaveTransition
          key={bagWaveKey}
          onComplete={() => setBagWaveKey((current) => (current === bagWaveKey ? 0 : current))}
        />
      )}

      {/* Quick View Modal */}
      <ProductDetailModal
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        isWishlisted={quickViewProduct ? wishlistIds.includes(quickViewProduct.id) : false}
        onToggleWishlist={handleToggleWishlist}
        onAddToCart={async (product, qty, color, size, variantId, includeFallPico) => {
          const added = await handleAddToCart(product, qty, color, size, variantId, includeFallPico);
          if (added) setIsCartOpen(true);
          return added;
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
