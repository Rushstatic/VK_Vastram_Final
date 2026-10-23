import React from 'react';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';
import { ScrollReveal } from '../ui/ScrollReveal';
import { CATEGORIES } from '../../data/catalog';
import { PageView } from '../../types';
import { ArrowUpRight } from 'lucide-react';

interface CategoryShowcaseProps {
  categories?: any[];
  /** True until the live categories have been fetched. Shows a skeleton instead of built-in images. */
  loading?: boolean;
  onNavigate: (page: PageView) => void;
}

export const CategoryShowcase: React.FC<CategoryShowcaseProps> = ({
  categories,
  loading = false,
  onNavigate,
}) => {
  const hasLiveCategories = Boolean(categories && categories.length > 0);
  if (loading && !hasLiveCategories) {
    return (
      <section className="py-7 sm:py-14 lg:py-20 bg-[#FAF8F5]" aria-busy="true">
        <Container>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] bg-[#EFE9DC] rounded-xs animate-pulse" />
            ))}
          </div>
        </Container>
      </section>
    );
  }

  const displayCategories = (categories && categories.length > 0)
    ? categories
    : CATEGORIES.map((c, i) => ({
        id: c.id,
        title: c.title,
        subtitle: c.subtitle,
        category: c.category,
        image: c.image,
        itemCount: c.itemCount,
      }));

  return (
    <section className="py-7 sm:py-14 lg:py-20 bg-[#FAF8F5]">
      <Container>
        <ScrollReveal distance={16} duration={550}>
          <SectionHeading
            kicker="Textile Collections"
            title="Rooted in Craft, Woven for Every Space"
            subtitle="Explore our curated textile drapes—from ceremonial silk sarees to breathable bedding."
          />
        </ScrollReveal>

        <div
          className="-mx-4 px-4 sm:mx-0 sm:px-0 flex gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory pb-3 sm:pb-4 overscroll-x-contain md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:pb-0 lg:gap-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Browse textile categories"
        >
          {displayCategories.map((cat, index) => (
            <div key={cat.id} className="snap-start shrink-0 min-w-0 w-[88%] sm:w-[58%] md:w-auto">
            <ScrollReveal delay={index * 100} duration={650} distance={20}>
              <div
                onClick={() => onNavigate({ type: 'collection', category: cat.category })}
                className="group relative flex h-full flex-col bg-[#F4EFE6] rounded-xs overflow-hidden cursor-pointer border border-[#1C1917]/10 transition-all duration-300 hover:border-[#1C1917]/30"
              >
                {/* Image Box */}
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#EFE9DC]">
                  <img
                    src={cat.image}
                    alt={cat.title}
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1C1917]/70 via-[#1C1917]/20 to-transparent" />

                  {/* Bottom Overlay Info */}
                  <div className="absolute inset-x-0 bottom-0 p-3 sm:p-5 text-[#FAF8F5] flex items-end justify-between min-w-0">
                    <div>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-[#E5D7B7] font-medium block mb-1">
                        0{index + 1} · {cat.itemCount || 8} Weaves
                      </span>
                      <h3 className="font-serif text-xl sm:text-2xl text-white font-normal group-hover:text-[#E5D7B7] transition-all duration-300 group-hover:translate-x-1">
                        {cat.title}
                      </h3>
                      <p className="text-xs text-[#FAF8F5]/80 mt-1 line-clamp-1 font-normal">
                        {cat.subtitle}
                      </p>
                    </div>

                    <div className="w-8 h-8 rounded-full bg-[#FAF8F5]/20 backdrop-blur-xs flex items-center justify-center text-white group-hover:bg-[#FAF8F5] group-hover:text-[#1C1917] transition-all duration-300 shrink-0 ml-2">
                      <ArrowUpRight className="w-4 h-4 transition-transform duration-300 ease-out group-hover:translate-x-1 group-hover:-translate-y-0.5" />
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
};
