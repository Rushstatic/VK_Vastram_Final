import React, { useState, useEffect, useRef } from 'react';
import { Search, Heart, ShoppingBag, Menu, X, User, Plus, Minus, Mail, Phone, Clock } from 'lucide-react';
import { Container } from '../ui/Container';
import { PageView } from '../../types';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { adminService, CollectionAdminData } from '../../services/adminService';
import DefaultLogo from '../../assets/images/vk_emblem_small_1791213158854.jpg';
import { gsap } from '../../lib/gsap';

interface HeaderProps {
  currentPage: PageView;
  onNavigate: (page: PageView) => void;
  cartCount: number;
  wishlistCount: number;
  onOpenCart: () => void;
  onOpenSearch: () => void;
  isCustomerLoggedIn?: boolean;
  customerName?: string;
  categories?: any[];
}

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  onNavigate,
  cartCount,
  wishlistCount,
  onOpenCart,
  onOpenSearch,
  isCustomerLoggedIn = false,
  customerName,
  categories,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const { settings, loading: settingsLoading } = useSiteSettings();
  const storeName = settings?.storeName || 'VK VASTRAM';

  // Smooth close helper that triggers exit animation before unmounting
  const handleCloseMenu = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setMobileMenuOpen(false);
      setIsClosing(false);
    }, 380); // matches drawer exit transition duration
  };

  // Lock body scroll gracefully while drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [mobileMenuOpen]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const bar = progressBarRef.current;
    if (!bar) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        bar,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: {
            start: 'top top',
            end: 'max',
            scrub: 0.15,
          },
        }
      );
    });

    return () => {
      ctx.revert();
    };
  }, []);

  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({});
  const [activeCollections, setActiveCollections] = useState<CollectionAdminData[]>([]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      setOpenAccordions({});
    }
  }, [mobileMenuOpen]);

  useEffect(() => {
    adminService.getCollections().then((cols) => {
      setActiveCollections(cols.filter((c) => c.isActive !== false));
    }).catch(() => {});
  }, []);

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const dynamicCategoryLinks = (categories && categories.length > 0)
    ? categories.map((cat) => ({
        label: cat.title,
        page: { type: 'collection', category: cat.category } as PageView,
      }))
    : [
        { label: 'Sarees', page: { type: 'collection', category: 'sarees' } as PageView },
        { label: 'Bedsheets', page: { type: 'collection', category: 'bedsheets' } as PageView },
        { label: 'Home Textiles', page: { type: 'collection', category: 'home-textiles' } as PageView },
      ];

  const hasBedsheets = categories
    ? categories.some((c) => c.category === 'bedsheets' || c.slug === 'bedsheets')
    : false;

  const mainNavLinks: { label: string; page: PageView }[] = [
    ...dynamicCategoryLinks,
    { label: 'Sale', page: { type: 'sale' } as PageView },
    { label: 'Our Story', page: { type: 'about' } as PageView },
  ];

  const mobileNavLinks: { label: string; page: PageView }[] = [
    { label: 'Home', page: { type: 'home' } as PageView },
    ...dynamicCategoryLinks.map(link => ({
      label: `${link.label} Collection`,
      page: link.page,
    })),
    { label: 'Seasonal Sale', page: { type: 'sale' } as PageView },
    { label: 'Our Story & Heritage', page: { type: 'about' } as PageView },
    { label: 'FAQ & Client Care', page: { type: 'faq' } as PageView },
    { label: 'Contact Us', page: { type: 'contact' } as PageView },
  ];

  const isLinkActive = (target: PageView) => {
    if (currentPage.type === target.type) {
      if (currentPage.type === 'collection' && target.type === 'collection') {
        return currentPage.category === target.category;
      }
      return true;
    }
    return false;
  };

  const handleNavClick = (page: PageView) => {
    handleCloseMenu();
    setTimeout(() => {
      onNavigate(page);
    }, 150);
  };

  return (
    <>
      <header className={`sticky top-0 z-30 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-[#1C1917]/10 transition-all duration-300 ${scrolled ? 'shadow-[0_1px_3px_rgba(28,25,23,0.05)]' : ''}`}>
        <Container>
          <div className={`flex items-center justify-between transition-all duration-300 ${scrolled ? 'h-15 sm:h-17' : 'h-20 sm:h-22'}`}>
            {/* Mobile Left: Menu Toggle */}
            <div className="flex items-center lg:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                className="p-2 -ml-2 text-[#1C1917] hover:text-[#967029] cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>

            {/* Desktop Left: Navigation Links */}
            <nav className="hidden lg:flex items-center gap-7 text-xs tracking-wider uppercase font-medium">
              {mainNavLinks.map((link, idx) => {
                const active = isLinkActive(link.page);
                return (
                  <button
                    key={idx}
                    onClick={() => handleNavClick(link.page)}
                    className={`relative py-1 cursor-pointer transition-colors duration-150 whitespace-nowrap ${
                      active
                        ? 'text-[#1C1917] font-semibold'
                        : 'text-[#57534E] hover:text-[#1C1917]'
                    }`}
                  >
                    {link.label}
                    {active && (
                      <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#B88E3E]" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Center / Brand Zone: VK VASTRAM Wordmark */}
            <div className="flex items-center justify-center min-w-0">
              <button
                type="button"
                onClick={() => handleNavClick({ type: 'home' })}
                className="flex items-center gap-2 sm:gap-3.5 text-center group cursor-pointer focus-visible:outline-none"
              >
                {/* Logo Area */}
                {/* Logo Area */}
<div
  className={`relative flex items-center justify-center shrink-0 transition-all duration-300 ${
    scrolled
      ? 'w-7 h-7 sm:w-9 sm:h-9'
      : 'w-10 h-10 sm:w-14 sm:h-14 lg:w-16 lg:h-16'
  }`}
>
  {/* Spinning Ring */}
  <div className="absolute inset-0 border border-[#78281F]/30 rounded-full animate-spin-slow pointer-events-none" />

  {/* Actual Logo Image - fills the circle (with small 2-3px inset so it sits cleanly inside the ring) */}
  {settings?.logoUrl ? (
    <img
      src={settings.logoUrl}
      alt="VK VASTRAM logo"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = DefaultLogo;
      }}
      className="w-full h-full p-0.5 rounded-full object-contain transition-opacity duration-150"
    />
  ) : settingsLoading ? (
    <span aria-hidden="true" className="block w-full h-full rounded-full bg-[#F4EFE6]/70" />
  ) : (
    <img
      src={DefaultLogo}
      alt="VK VASTRAM logo"
      className="w-full h-full p-0.5 rounded-full object-contain"
    />
  )}
</div>

                <span className={`font-serif font-semibold text-[#78281F] uppercase transition-all duration-300 group-hover:text-[#967029] whitespace-nowrap ${scrolled ? 'text-sm sm:text-xl lg:text-2xl tracking-[0.12em] sm:tracking-[0.28em]' : 'text-base sm:text-3xl lg:text-5xl tracking-[0.16em] sm:tracking-[0.35em]'}`}>
                  {storeName}
                </span>
              </button>
            </div>

            {/* Right: Actions (Search, Account [desktop only], Wishlist, Bag) */}
            <div className="flex items-center gap-0.5 sm:gap-2">
              <button
                type="button"
                onClick={onOpenSearch}
                aria-label="Search catalog"
                className="p-1.5 sm:p-2 text-[#1C1917] hover:text-[#967029] hover:bg-[#F4EFE6] rounded-xs transition-colors cursor-pointer"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Account Portal Button - Desktop only; on mobile it is in hamburger drawer */}
              <button
                type="button"
                onClick={() =>
                  handleNavClick(isCustomerLoggedIn ? { type: 'account' } : { type: 'login' })
                }
                title={isCustomerLoggedIn ? `Account (${customerName || 'Customer'})` : 'Sign In'}
                aria-label="Customer Account"
                className="hidden sm:flex p-2 text-[#1C1917] hover:text-[#967029] hover:bg-[#F4EFE6] rounded-xs transition-colors cursor-pointer relative"
              >
                <User className="w-5 h-5" />
                {isCustomerLoggedIn && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#B88E3E]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleNavClick({ type: 'wishlist' })}
                aria-label="View saved items"
                className="relative p-1.5 sm:p-2 text-[#1C1917] hover:text-[#967029] hover:bg-[#F4EFE6] rounded-xs transition-colors cursor-pointer"
              >
                <Heart className="w-5 h-5" />
                {wishlistCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-4 h-4 bg-[#78281F] text-[#FAF8F5] text-[10px] font-semibold flex items-center justify-center rounded-full tabular-nums">
                    {wishlistCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={onOpenCart}
                aria-label={`Shopping bag containing ${cartCount} items`}
                className="relative flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 text-[#FAF8F5] bg-[#1C1917] hover:bg-[#2E2926] rounded-xs transition-colors ml-0.5 sm:ml-1 cursor-pointer"
              >
                <ShoppingBag className="w-5 h-5 sm:w-4 sm:h-4" />
                {cartCount > 0 && (
                  <span className="sm:hidden absolute -top-1 -right-1 w-4 h-4 bg-[#B88E3E] text-[#1C1917] text-[10px] font-bold flex items-center justify-center rounded-full tabular-nums">
                    {cartCount}
                  </span>
                )}
                <span className="hidden sm:inline text-xs font-medium tabular-nums">
                  Bag {cartCount > 0 && `(${cartCount})`}
                </span>
              </button>
            </div>
          </div>
        </Container>
        {/* Editorial Scroll Reading Progress Indicator */}
        <div
          ref={progressBarRef}
          aria-hidden="true"
          className="h-[1.5px] w-full bg-[#B88E3E] origin-left scale-x-0"
        />
      </header>

      {/* Mobile Drawer Navigation (Information Architecture per Prompt 26B) */}
      {(mobileMenuOpen || isClosing) && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop with silky fade animation */}
          <div
            ref={backdropRef}
            className={`fixed inset-0 bg-[#1C1917]/42 transition-opacity duration-350 ease-out ${
              isClosing ? 'opacity-0 backdrop-blur-none pointer-events-none' : 'opacity-100 backdrop-blur-[3px]'
            }`}
            onClick={handleCloseMenu}
          />
          {/* Drawer Sheet with luxurious smooth sliding cubic-bezier animation */}
          <div
            ref={drawerRef}
            className={`relative w-[min(88vw,24rem)] max-w-full vk-glass-surface rounded-r-2xl [clip-path:polygon(0_0,calc(100%_-_12px)_0,100%_12px,100%_calc(100%_-_12px),calc(100%_-_12px)_100%,0_100%)] h-full flex flex-col z-10 border-r transform transition-transform duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isClosing ? '-translate-x-full' : 'translate-x-0'
            }`}
            style={{
              animation: isClosing ? 'none' : 'drawerSlideIn 380ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#1C1917]/10 bg-[#FAF8F5]/65 backdrop-blur-xl">
              <div className="flex items-center gap-2.5">
                <div className="relative w-7 h-7 flex items-center justify-center shrink-0">
                  <div className="absolute inset-0 border border-[#78281F]/30 rounded-full animate-spin-slow pointer-events-none" />
                  <img
                    src={settings?.logoUrl || DefaultLogo}
                    alt="Store Logo"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = DefaultLogo;
                    }}
                    className="w-5.5 h-5.5 rounded-full object-cover"
                  />
                </div>
                <span className="font-serif text-xl sm:text-2xl lg:text-3xl font-medium tracking-[0.16em] text-[#78281F] uppercase">
                  {storeName}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCloseMenu}
                aria-label="Close menu"
                className="p-1.5 text-[#57534E] hover:text-[#1C1917] hover:bg-[#F4EFE6] rounded-xs transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body with Clean Hierarchical IA */}
            <div className="flex-1 overflow-y-auto px-6 py-6 text-left space-y-6">
              {/* MENU Section Kicker */}
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] font-semibold text-[#78716C] mb-3">
                  Menu
                </p>

                {/* Primary Nav List */}
                <div className="space-y-0 divide-y divide-[#1C1917]/10 border-y border-[#1C1917]/10">
                  {/* 1. New In */}
                  <div className="py-3.5 transition-transform hover:translate-x-1 duration-200">
                    <button
                      type="button"
                      onClick={() => handleNavClick({ type: 'collection', category: 'sarees' })}
                      className="w-full flex items-center justify-between text-base font-medium text-[#1C1917] hover:text-[#78281F] transition-colors cursor-pointer group"
                    >
                      <span className="group-hover:translate-x-0.5 transition-transform duration-200">New In</span>
                      <span className="text-[10px] tracking-widest uppercase bg-[#78281F] text-[#FAF8F5] px-2 py-0.5 rounded-xs font-semibold shadow-xs">
                        Fresh
                      </span>
                    </button>
                  </div>

                  {/* 2. Sarees + Accordion */}
                  <div className="py-3.5">
                    <button
                      type="button"
                      onClick={() => toggleAccordion('sarees')}
                      className="w-full flex items-center justify-between text-base font-medium text-[#1C1917] hover:text-[#78281F] transition-colors cursor-pointer"
                    >
                      <span>Sarees</span>
                      <span className="text-[#78716C] transition-transform duration-300">
                        {openAccordions['sarees'] ? (
                          <Minus className="w-4 h-4 text-[#78281F] transition-transform duration-200 rotate-180" />
                        ) : (
                          <Plus className="w-4 h-4 transition-transform duration-200" />
                        )}
                      </span>
                    </button>

                    <div
                      className={`grid transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${
                        openAccordions['sarees']
                          ? 'grid-rows-[1fr] opacity-100 mt-2.5'
                          : 'grid-rows-[0fr] opacity-0 mt-0 pointer-events-none'
                      }`}
                    >
                      <div className="min-h-0 pl-3 space-y-2.5 text-sm text-[#57534E] pb-1 border-l-2 border-[#B88E3E]/30 ml-1">
                        <button
                          type="button"
                          onClick={() => handleNavClick({ type: 'collection', category: 'sarees' })}
                          className="block w-full text-left font-medium text-[#1C1917] hover:text-[#78281F] transition-all hover:translate-x-1 duration-150 cursor-pointer"
                        >
                          All Sarees
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNavClick({ type: 'collection', category: 'sarees', subCategory: 'Kadwa Brocade Handloom' })}
                          className="block w-full text-left hover:text-[#1C1917] transition-all hover:translate-x-1 duration-150 cursor-pointer"
                        >
                          Banarasi & Brocade Handlooms
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNavClick({ type: 'collection', category: 'sarees', subCategory: 'Korvai Interlock Handloom' })}
                          className="block w-full text-left hover:text-[#1C1917] transition-all hover:translate-x-1 duration-150 cursor-pointer"
                        >
                          Kanjivaram Silk Sarees
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNavClick({ type: 'collection', category: 'sarees', subCategory: 'Chanderi Handloom' })}
                          className="block w-full text-left hover:text-[#1C1917] transition-all hover:translate-x-1 duration-150 cursor-pointer"
                        >
                          Chanderi & Delicate Silks
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNavClick({ type: 'collection', category: 'sarees', subCategory: 'Korvai Interlock Handloom' })}
                          className="block w-full text-left hover:text-[#1C1917] transition-all hover:translate-x-1 duration-150 cursor-pointer"
                        >
                          Korvai Interlock Silks
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 3. Bedsheets + Accordion (Only if active category) */}
                  {hasBedsheets && (
                    <div className="py-3.5">
                      <button
                        type="button"
                        onClick={() => toggleAccordion('bedsheets')}
                        className="w-full flex items-center justify-between text-base font-medium text-[#1C1917] hover:text-[#78281F] transition-colors cursor-pointer"
                      >
                        <span>Bedsheets</span>
                        <span className="text-[#78716C] transition-transform duration-300">
                          {openAccordions['bedsheets'] ? (
                            <Minus className="w-4 h-4 text-[#78281F] rotate-180 transition-transform duration-200" />
                          ) : (
                            <Plus className="w-4 h-4 transition-transform duration-200" />
                          )}
                        </span>
                      </button>

                      <div
                        className={`grid transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${
                          openAccordions['bedsheets']
                            ? 'grid-rows-[1fr] opacity-100 mt-2.5'
                            : 'grid-rows-[0fr] opacity-0 mt-0 pointer-events-none'
                        }`}
                      >
                        <div className="min-h-0 pl-3 space-y-2.5 text-sm text-[#57534E] pb-1 border-l-2 border-[#B88E3E]/30 ml-1">
                          <button
                            type="button"
                            onClick={() => handleNavClick({ type: 'collection', category: 'bedsheets' })}
                            className="block w-full text-left font-medium text-[#1C1917] hover:text-[#78281F] transition-all hover:translate-x-1 duration-150 cursor-pointer"
                          >
                            All Bedsheets
                          </button>
                          <button
                            type="button"
                            onClick={() => handleNavClick({ type: 'collection', category: 'bedsheets' })}
                            className="block w-full text-left hover:text-[#1C1917] transition-all hover:translate-x-1 duration-150 cursor-pointer"
                          >
                            Hand-block Botanical Cotton
                          </button>
                          <button
                            type="button"
                            onClick={() => handleNavClick({ type: 'collection', category: 'bedsheets' })}
                            className="block w-full text-left hover:text-[#1C1917] transition-all hover:translate-x-1 duration-150 cursor-pointer"
                          >
                            High Thread Count Percale
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4. Collections + Accordion */}
                  <div className="py-3.5">
                    <button
                      type="button"
                      onClick={() => toggleAccordion('collections')}
                      className="w-full flex items-center justify-between text-base font-medium text-[#1C1917] hover:text-[#78281F] transition-colors cursor-pointer"
                    >
                      <span>Collections</span>
                      <span className="text-[#78716C] transition-transform duration-300">
                        {openAccordions['collections'] ? (
                          <Minus className="w-4 h-4 text-[#78281F] rotate-180 transition-transform duration-200" />
                        ) : (
                          <Plus className="w-4 h-4 transition-transform duration-200" />
                        )}
                      </span>
                    </button>

                    <div
                      className={`grid transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${
                        openAccordions['collections']
                          ? 'grid-rows-[1fr] opacity-100 mt-2.5'
                          : 'grid-rows-[0fr] opacity-0 mt-0 pointer-events-none'
                      }`}
                    >
                      <div className="min-h-0 pl-3 space-y-2.5 text-sm text-[#57534E] pb-1 border-l-2 border-[#B88E3E]/30 ml-1">
                        {activeCollections.length > 0 ? (
                          activeCollections.map((col) => (
                            <button
                              key={col.id}
                              type="button"
                              onClick={() => handleNavClick({ type: 'collection', category: 'sarees' })}
                              className="block w-full text-left hover:text-[#1C1917] transition-all hover:translate-x-1 duration-150 cursor-pointer"
                            >
                              {col.name}
                            </button>
                          ))
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleNavClick({ type: 'collection', category: 'sarees' })}
                              className="block w-full text-left hover:text-[#1C1917] transition-all hover:translate-x-1 duration-150 cursor-pointer"
                            >
                              Heritage Sarees
                            </button>
                            <button
                              type="button"
                              onClick={() => handleNavClick({ type: 'collection', category: 'sarees' })}
                              className="block w-full text-left hover:text-[#1C1917] transition-all hover:translate-x-1 duration-150 cursor-pointer"
                            >
                              Artisanal Home Textiles
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 5. Sale */}
                  <div className="py-3.5 transition-transform hover:translate-x-1 duration-200">
                    <button
                      type="button"
                      onClick={() => handleNavClick({ type: 'sale' })}
                      className="w-full flex items-center justify-between text-base font-medium text-[#78281F] hover:text-[#967029] transition-colors cursor-pointer group"
                    >
                      <span className="group-hover:translate-x-0.5 transition-transform duration-200 font-serif italic text-lg">Sale</span>
                      <span className="text-xs font-serif italic text-[#78281F]">Curated Offers</span>
                    </button>
                  </div>

                  {/* 6. Wishlist */}
                  <div className="py-3.5 transition-transform hover:translate-x-1 duration-200">
                    <button
                      type="button"
                      onClick={() => handleNavClick({ type: 'wishlist' })}
                      className="w-full flex items-center justify-between text-base font-medium text-[#1C1917] hover:text-[#78281F] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Heart className="w-4 h-4 text-[#78281F] group-hover:scale-110 transition-transform duration-200" />
                        <span className="group-hover:translate-x-0.5 transition-transform duration-200">Wishlist</span>
                      </div>
                      {wishlistCount > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#78281F] text-[#FAF8F5] tabular-nums font-semibold shadow-xs">
                          {wishlistCount}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* 7. Search */}
                  <div className="py-3.5 transition-transform hover:translate-x-1 duration-200">
                    <button
                      type="button"
                      onClick={() => {
                        handleCloseMenu();
                        setTimeout(() => onOpenSearch(), 180);
                      }}
                      className="w-full flex items-center justify-between text-base font-medium text-[#1C1917] hover:text-[#78281F] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Search className="w-4 h-4 text-[#78716C] group-hover:text-[#967029] group-hover:scale-110 transition-all duration-200" />
                        <span className="group-hover:translate-x-0.5 transition-transform duration-200">Search Catalog</span>
                      </div>
                    </button>
                  </div>

                  {/* 8. Account */}
                  <div className="py-3.5 transition-transform hover:translate-x-1 duration-200">
                    <button
                      type="button"
                      onClick={() =>
                        handleNavClick(
                          isCustomerLoggedIn ? { type: 'account' } : { type: 'login' }
                        )
                      }
                      className="w-full flex items-center justify-between text-base font-medium text-[#1C1917] hover:text-[#78281F] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <User className="w-4 h-4 text-[#78716C] group-hover:text-[#967029] group-hover:scale-110 transition-all duration-200" />
                        <span className="group-hover:translate-x-0.5 transition-transform duration-200">{isCustomerLoggedIn ? 'My Patron Account' : 'Sign In / Register'}</span>
                      </div>
                      {isCustomerLoggedIn && (
                        <span className="w-2 h-2 rounded-full bg-[#B88E3E]" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Need Help? Section */}
              <div className="pt-2 border-t border-[#1C1917]/10 space-y-3">
                <p className="text-[11px] uppercase tracking-[0.25em] font-semibold text-[#78716C]">
                  Need Help?
                </p>

                <div className="space-y-2 text-xs text-[#57534E]">
                  <a
                    href="mailto:care@vkvastram.com"
                    className="flex items-center gap-2 hover:text-[#1C1917] transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5 text-[#967029] shrink-0" />
                    <span>care@vkvastram.com</span>
                  </a>

                  <a
                    href="tel:+919876543210"
                    className="flex items-center gap-2 hover:text-[#1C1917] transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#967029] shrink-0" />
                    <span>WhatsApp / Phone: +91 98765 43210</span>
                  </a>

                  <div className="flex items-center gap-2 text-[#78716C]">
                    <Clock className="w-3.5 h-3.5 text-[#967029] shrink-0" />
                    <span>Support: Mon–Sat, 10:00 AM – 7:00 PM IST</span>
                  </div>
                </div>

                {/* Currency */}
                <div className="pt-3 border-t border-[#1C1917]/10 flex items-center justify-between text-xs text-[#78716C]">
                  <span>Store Currency</span>
                  <span className="font-semibold text-[#1C1917]">INR (₹)</span>
                </div>
              </div>
            </div>

            {/* Bottom Sticky Bag Action */}
            <div className="p-4 border-t border-[#1C1917]/10 bg-[#FAF8F5]">
              <button
                type="button"
                onClick={() => {
                  handleCloseMenu();
                  setTimeout(() => onOpenCart(), 180);
                }}
                className="w-full py-3.5 bg-[#1C1917] hover:bg-[#2E2926] active:scale-[0.99] text-[#FAF8F5] rounded-xs text-xs uppercase tracking-wider font-medium flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>View Shopping Bag ({cartCount})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
