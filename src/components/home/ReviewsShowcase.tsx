import React, { useEffect, useState } from 'react';
import { Star, BadgeCheck, Quote } from 'lucide-react';
import { PageView } from '../../types';

interface ShowcaseItem {
  id: string;
  feedback: string;
  displayName: string;
  deliveryRating: number;
  packagingRating: number;
  overallRating: number;
  products: Array<{ name: string; slug: string; rating: number }>;
  createdAt: string;
}

const Stars: React.FC<{ value: number; size?: string }> = ({ value, size = 'w-3.5 h-3.5' }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} className={`${size} ${n <= Math.round(value) ? 'fill-[#B88E3E] text-[#B88E3E]' : 'text-[#D6CFC2]'}`} />
    ))}
  </span>
);

/**
 * "Words that wear beautifully": one card per reviewed order, shown under the hero.
 * Hides itself until there are real reviews, so no empty or placeholder content is shown.
 */
export const ReviewsShowcase: React.FC<{ onNavigate: (page: PageView) => void }> = ({ onNavigate }) => {
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [stats, setStats] = useState<{ average: number; count: number }>({ average: 0, count: 0 });

  useEffect(() => {
    let active = true;
    fetch('/api/reviews/showcase')
      .then((r) => r.json())
      .then((data) => {
        if (!active || !data?.success) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setStats(data.stats || { average: 0, count: 0 });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="reviews-heading" className="relative bg-[#F4EFE6] py-14 sm:py-20 overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#B88E3E]">Heard from our customers</p>
          <h2 id="reviews-heading" className="font-serif text-3xl sm:text-5xl text-[#1C1917] mt-3 leading-tight">
            Words that wear <em className="text-[#78281F]">beautifully</em>
          </h2>
          <div className="flex items-center justify-center gap-3 mt-4">
            <span className="h-px w-10 bg-[#B88E3E]/60" aria-hidden="true" />
            <span className="h-1.5 w-1.5 rotate-45 bg-[#B88E3E]" aria-hidden="true" />
            <span className="h-px w-10 bg-[#B88E3E]/60" aria-hidden="true" />
          </div>
          {stats.count > 0 && (
            <div className="mt-5 inline-flex items-center gap-2.5 bg-[#FAF8F5] border border-[#1C1917]/10 px-4 py-2 rounded-full text-sm text-[#1C1917]">
              <Stars value={stats.average} />
              <span className="font-medium">{stats.average.toFixed(1)}</span>
              <span className="text-[#78716C]">from {stats.count} {stats.count === 1 ? 'rating' : 'ratings'}</span>
            </div>
          )}
        </div>

        {/* Phones: swipe through the cards. Desktop: three across. */}
        <div className="mt-10 sm:mt-14 -mx-5 sm:mx-0 px-5 sm:px-0 flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 overflow-x-auto snap-x snap-mandatory pb-4 sm:pb-0 [scrollbar-width:none]">
          {items.slice(0, 9).map((item) => (
            <article
              key={item.id}
              className="snap-start shrink-0 w-[82%] sm:w-auto relative flex flex-col bg-[#FAF8F5] border border-[#1C1917]/10 rounded-sm p-6 sm:p-7 shadow-[0_1px_0_rgba(28,25,23,0.04),0_18px_40px_-28px_rgba(120,40,31,0.35)]"
            >
              <Quote className="absolute top-5 right-5 w-8 h-8 text-[#B88E3E]/25" aria-hidden="true" />
              <Stars value={item.overallRating || 5} size="w-4 h-4" />
              <p className="font-serif text-[17px] sm:text-lg leading-relaxed text-[#1C1917] mt-4 line-clamp-6">
                <span aria-hidden="true" className="text-[#B88E3E]">“</span>
                {item.feedback}
                <span aria-hidden="true" className="text-[#B88E3E]">”</span>
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {item.products.slice(0, 3).map((p) => (
                  <button
                    key={`${item.id}-${p.name}`}
                    type="button"
                    onClick={() => p.slug && onNavigate({ type: 'product', slug: p.slug })}
                    className="text-[11px] tracking-wide px-2.5 py-1 border border-[#B88E3E]/40 text-[#78281F] bg-[#F4EFE6] hover:bg-[#EFE9DC] rounded-full cursor-pointer"
                  >
                    {p.name} · {p.rating}★
                  </button>
                ))}
              </div>

              <footer className="mt-auto pt-5 mt-6 border-t border-[#1C1917]/10 flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-medium text-[#1C1917] text-sm">{item.displayName}</p>
                  <p className="text-[#78716C] mt-0.5">Delivery {item.deliveryRating}★ · Packaging {item.packagingRating}★</p>
                </div>
                <span className="inline-flex items-center gap-1 text-[#2F5D3A] whitespace-nowrap">
                  <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" /> Verified purchase
                </span>
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
