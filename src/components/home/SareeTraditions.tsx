import React, { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Product, PageView } from '../../types';
import { Container } from '../ui/Container';
import { ScrollReveal } from '../ui/ScrollReveal';
import { AnimatedSplitHeading } from '../ui/AnimatedSplitHeading';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface SareeTraditionsProps {
  products: Product[];
  onNavigate: (page: PageView) => void;
}

export const SareeTraditions: React.FC<SareeTraditionsProps> = ({ products, onNavigate }) => {
  const [cmsTypes, setCmsTypes] = useState<Array<{ name: string; imageUrl?: string }> | null>(null);
  const sarees = products.filter((p) => p.category === 'sarees' && p.status !== 'draft' && p.status !== 'archived');

  useEffect(() => {
    let active = true;
    const loadCmsTypes = async () => {
      if (!isSupabaseConfigured()) return;
      const { data, error } = await (supabase as any)
        .from('site_settings')
        .select('value')
        .eq('key', 'saree_types')
        .maybeSingle();
      if (!active || error) return;
      // Supabase JSONB normally returns an object, but tolerate serialized JSON too.
      let settingValue: any = data?.value;
      if (typeof settingValue === 'string') {
        try { settingValue = JSON.parse(settingValue); } catch { settingValue = null; }
      }
      if (!Array.isArray(settingValue?.types)) {
        setCmsTypes(null);
        return;
      }
      setCmsTypes(settingValue.types
        .filter((type: any) => type && type.active !== false && typeof type.name === 'string')
        .map((type: any) => ({
          name: type.name.trim(),
          imageUrl: typeof type.imageUrl === 'string' ? type.imageUrl.trim() : '',
        }))
        .filter((type: any) => Boolean(type.name)));
    };
    void loadCmsTypes();
    const refresh = () => { void loadCmsTypes(); };
    const channel = (supabase as any).channel('public-saree-type-settings-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings', filter: 'key=eq.saree_types' }, refresh)
      .subscribe();
    window.addEventListener('vk_saree_types_updated', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => { active = false; window.removeEventListener('vk_saree_types_updated', refresh); window.removeEventListener('storage', refresh); window.removeEventListener('focus', refresh); void (supabase as any).removeChannel(channel); };
  }, []);

  const availableTypes = cmsTypes ?? Array.from(
    new Set(sarees.map((product) => product.subCategory?.trim()).filter((value): value is string => Boolean(value)))
  ).map((name) => ({ name, imageUrl: '' }));
  // CMS is the source of truth for active cards. A type can be featured before
  // its first product is assigned; a matching product image is only the fallback.
  const traditions = availableTypes
    .map((type) => ({
      ...type,
      product: sarees.find((product) => product.subCategory?.trim().toLocaleLowerCase() === type.name.trim().toLocaleLowerCase()),
    }))
    .slice(0, 6);
  if (!traditions.length) return null;

  return (
    <section className="pt-8 pb-7 sm:py-16 bg-[#FAF8F5]">
      <Container>
        <ScrollReveal distance={14} duration={550}>
          <div className="flex items-end justify-between gap-4 mb-5 sm:mb-8">
            <div className="max-w-2xl">
              <span className="text-[10px] uppercase tracking-[0.24em] text-[#967029] font-medium">The Stories in Every Weave</span>
              <AnimatedSplitHeading text="Explore Saree Traditions" className="font-serif text-2xl sm:text-3xl text-[#1C1917] mt-2" />
              <p className="text-sm text-[#57534E] mt-2">Discover the character and craft behind each drape.</p>
            </div>
            <button type="button" onClick={() => onNavigate({ type: 'collection', category: 'sarees' })} className="hidden sm:inline-flex items-center gap-1.5 text-xs text-[#78281F] hover:text-[#967029] transition-colors">All sarees <ArrowUpRight className="w-4 h-4" /></button>
          </div>
        </ScrollReveal>
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex items-start gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory pb-1 overscroll-x-contain sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {traditions.map(({ name, product, imageUrl }, index) => (
            <ScrollReveal key={name} className="w-[min(64vw,15rem)] shrink-0 sm:w-auto sm:min-w-0" delay={index * 55} duration={500} distance={12}>
              <button type="button" onClick={() => onNavigate({ type: 'collection', category: 'sarees', subCategory: name })} className="group snap-start block w-full sm:w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B88E3E] rounded-full">
                <div className="relative aspect-square w-full overflow-hidden bg-[#EFE9DC] rounded-full border border-[#B88E3E]/60 p-1 shadow-sm">
                  {(imageUrl || product?.primaryImage) ? (
                    <img src={imageUrl || product?.primaryImage || ''} alt={`${name} saree`} loading="lazy" decoding="async" fetchPriority="low" className="w-full h-full object-cover rounded-full transition-transform duration-500 ease-out motion-reduce:transition-none group-hover:scale-[1.035]" />
                  ) : (
                    <div aria-label={`${name} saree image coming soon`} className="w-full h-full rounded-full bg-gradient-to-br from-[#E8DDC7] via-[#C7B58F] to-[#5D4A3B]" />
                  )}
                  <div className="absolute inset-1 rounded-full bg-gradient-to-t from-[#1C1917]/78 via-[#1C1917]/12 to-transparent opacity-85 group-hover:opacity-95 transition-opacity" />
                  <span className="absolute left-3 right-3 bottom-5 sm:bottom-6 text-center font-serif text-sm sm:text-base leading-snug text-white line-clamp-2 break-words">{name}</span>
                  <span className="absolute top-[12%] right-[12%] w-7 h-7 rounded-full border border-[#B88E3E]/60 bg-[#FAF8F5] text-[#78281F] shadow-sm flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </div>
              </button>
            </ScrollReveal>
          ))}
        </div>
      </Container>
    </section>
  );
};
