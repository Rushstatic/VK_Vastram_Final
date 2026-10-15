import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Product, PageView } from '../../types';
import { Container } from '../ui/Container';
import { ScrollReveal } from '../ui/ScrollReveal';
import { AnimatedSplitHeading } from '../ui/AnimatedSplitHeading';

interface BudgetDiscoveryProps {
  products: Product[];
  onNavigate: (page: PageView) => void;
}

const BANDS = [
  { label: 'Under ₹1,000', min: 0, max: 999, kicker: 'EVERYDAY FINDS', note: 'Thoughtful styles for less', tone: 'ivory' },
  { label: '₹1,000–₹1,499', min: 1000, max: 1499, kicker: 'CUSTOMER FAVOURITES', note: 'Beautifully balanced picks', tone: 'sand' },
  { label: '₹1,500–₹1,999', min: 1500, max: 1999, kicker: 'SPECIAL OCCASIONS', note: 'A little something special', tone: 'rose' },
  { label: '₹2,000–₹2,500', min: 2000, max: 2500, kicker: 'THE PREMIUM EDIT', note: 'Elevated everyday elegance', tone: 'maroon' },
] as const;

export const BudgetDiscovery: React.FC<BudgetDiscoveryProps> = ({ products, onNavigate }) => {
  const sarees = products.filter((p) => p.category === 'sarees' && p.status !== 'draft' && p.status !== 'archived');
  const bands = BANDS.map((band) => ({ ...band, count: sarees.filter((p) => p.price >= band.min && p.price <= band.max).length }));
  if (!sarees.length || !bands.some((band) => band.count > 0)) return null;

  return (
    <section className="py-10 sm:py-16 bg-[#F4EFE6]/45">
      <Container>
        <ScrollReveal distance={14} duration={550}>
          <div className="max-w-2xl mb-6 sm:mb-8">
            <span className="text-[10px] uppercase tracking-[0.24em] text-[#967029] font-medium">A Thoughtful Way to Shop</span>
            <AnimatedSplitHeading text="Find Your Saree by Budget" className="font-serif text-2xl sm:text-3xl text-[#1C1917] mt-2" />
            <p className="text-sm text-[#57534E] mt-2">Beautiful drapes for the occasion—and the budget you have in mind.</p>
          </div>
        </ScrollReveal>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {bands.map((band, index) => (
            <ScrollReveal key={band.label} delay={index * 70} duration={500} distance={12}>
              <button type="button" disabled={band.count === 0} onClick={() => onNavigate({ type: 'collection', category: 'sarees', priceMin: band.min, priceMax: band.max })}
                className={`group relative flex w-full min-h-[176px] sm:min-h-[184px] flex-col text-left p-3.5 sm:p-5 border transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B88E3E] disabled:cursor-not-allowed ${band.count === 0 ? 'opacity-75' : ''} ${band.tone === 'maroon' ? 'bg-[#78281F] text-[#FAF8F5] border-[#78281F] hover:bg-[#642019] hover:shadow-[0_0_0_1px_rgba(184,142,62,0.55),0_8px_28px_-16px_rgba(184,142,62,0.8)]' : band.tone === 'rose' ? 'bg-[#EEE1D9] text-[#1C1917] border-[#D9C8BA] hover:border-[#B88E3E]' : band.tone === 'sand' ? 'bg-[#ECE5D8] text-[#1C1917] border-[#DED3C1] hover:border-[#B88E3E]' : 'bg-[#FAF8F5] text-[#1C1917] border-[#1C1917]/10 hover:border-[#B88E3E]'}`}>
                <span className={`block text-[8px] sm:text-[10px] leading-snug tracking-[0.14em] sm:tracking-[0.18em] font-medium mb-3 min-h-[1.8em] ${band.tone === 'maroon' ? 'text-[#E6C98B]' : 'text-[#967029]'}`}>{band.kicker}</span>
                <span className="block font-serif text-[16px] sm:text-xl leading-snug break-words">{band.label}</span>
                <span className={`block text-[11px] sm:text-xs leading-snug mt-2 ${band.tone === 'maroon' ? 'text-[#FAF8F5]/85' : 'text-[#57534E]'}`}>{band.note}</span>
                <span className={`mt-auto pt-4 flex items-center justify-between gap-1 text-[10px] sm:text-xs ${band.tone === 'maroon' ? 'text-[#E6C98B]' : 'text-[#967029]'}`}>
                  <span>{band.count > 0 ? `${band.count} ${band.count === 1 ? 'style' : 'styles'}` : 'Coming soon'}</span>
                  <ArrowUpRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </button>
            </ScrollReveal>
          ))}
        </div>
      </Container>
    </section>
  );
};
