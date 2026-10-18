import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Product, PageView } from '../../types';
import { Container } from '../ui/Container';
import { ScrollReveal } from '../ui/ScrollReveal';
import { AnimatedSplitHeading } from '../ui/AnimatedSplitHeading';
import { useSareeTypes } from '../../hooks/useSareeTypes';
import { normalizeImageUrl } from '../../lib/imageHelper';

interface SareeTraditionsProps {
  products: Product[];
  onNavigate: (page: PageView) => void;
}

export const SareeTraditions: React.FC<SareeTraditionsProps> = ({ products, onNavigate }) => {
  const cmsTypes = useSareeTypes();
  const sarees = products.filter((p) => p.category === 'sarees' && p.status !== 'draft' && p.status !== 'archived');
  const availableTypes = cmsTypes.length ? cmsTypes : [];
  // Use only managed saree types; never infer a type from free-text weave values.
  const traditions = availableTypes
    .map((type) => ({
      ...type,
      imageUrl: normalizeImageUrl(type.imageUrl),
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
