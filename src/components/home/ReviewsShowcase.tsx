import React, { useEffect, useRef, useState } from 'react';
import { Star, ChevronLeft, ChevronRight, BadgeCheck } from 'lucide-react';
import { PageView } from '../../types';
import { buildStoreShareLink } from '../../lib/reviewShare';

interface ReviewProduct {
  name: string;
  slug: string;
  rating: number;
  image: string;
}

interface ReviewItem {
  id: string;
  feedback: string;
  displayName: string;
  overallRating: number;
  photos?: string[];
  products: ReviewProduct[];
}

const Stars: React.FC<{ value: number; className?: string }> = ({ value, className = 'w-4 h-4' }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} className={`${className} ${n <= Math.round(value) ? 'fill-[#1C1917] text-[#1C1917]' : 'text-[#D6CFC2]'}`} />
    ))}
  </span>
);

/**
 * Customer reviews under the homepage: average rating, then a sliding row of review cards.
 * Each card shows the customer's photo (or the product photo when there is none), the stars,
 * the name with a verified tick, and the product they bought. Hidden until there are reviews.
 */
export const ReviewsShowcase: React.FC<{ onNavigate?: (page: PageView) => void }> = ({ onNavigate }) => {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<{ average: number; count: number }>({ average: 0, count: 0 });
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/reviews/showcase')
      .then((r) => r.json())
      .then((data) => {
        if (!active || !data?.success) return;
        setItems(Array.isArray(data.items) ? data.items.filter((i: ReviewItem) => i.feedback).slice(0, 12) : []);
        setStats(data.stats || { average: 0, count: 0 });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const slide = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.firstElementChild as HTMLElement | null;
    const step = card ? card.offsetWidth + 20 : track.clientWidth * 0.8;
    track.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  if (stats.count === 0 || items.length === 0) return null;

  return (
    <section aria-labelledby="ratings-heading" className="bg-white py-14 sm:py-20">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="text-center">
          <h2 id="ratings-heading" className="font-sans text-2xl sm:text-4xl font-semibold text-[#1C1917]">
            What our loved customers are saying
          </h2>
          <div className="mt-4 inline-flex items-center gap-2 text-sm text-[#1C1917]">
            <Stars value={stats.average} className="w-4 h-4" />
            <span className="font-semibold">{stats.average.toFixed(2)}</span>
            <span aria-hidden="true">★</span>
            <span className="text-[#57534E]">({stats.count})</span>
          </div>
        </div>

        <div className="relative mt-10">
          <button
            type="button"
            onClick={() => slide(-1)}
            aria-label="Previous reviews"
            className="hidden sm:flex absolute -left-3 top-1/3 z-10 w-10 h-10 items-center justify-center bg-white border border-[#1C1917]/10 shadow-sm hover:bg-[#FAF8F5] cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => slide(1)}
            aria-label="Next reviews"
            className="hidden sm:flex absolute -right-3 top-1/3 z-10 w-10 h-10 items-center justify-center bg-white border border-[#1C1917]/10 shadow-sm hover:bg-[#FAF8F5] cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div
            ref={trackRef}
            className="flex gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((item) => {
              const product = item.products[0];
              const photo = item.photos && item.photos.length > 0 ? item.photos[0] : product?.image || '';
              return (
                <article key={item.id} className="snap-start shrink-0 w-[78%] sm:w-[calc(25%-15px)] bg-[#F7F5F2] flex flex-col">
                  <div className="aspect-[4/5] bg-[#E9E4DA] overflow-hidden">
                    {photo ? (
                      <img src={photo} alt={product ? `${product.name} shared by ${item.displayName}` : 'Photo shared by a customer'} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#967029] font-serif text-lg">VK VASTRAM</div>
                    )}
                  </div>
                  <div className="flex flex-col items-center text-center px-5 pt-5 pb-6 flex-1">
                    <p className="text-[15px] text-[#1C1917] line-clamp-2 min-h-[2.8em]">{item.feedback}</p>
                    <div className="mt-3"><Stars value={item.overallRating || 5} className="w-4 h-4" /></div>
                    <p className="mt-3 inline-flex items-center gap-1.5 font-semibold text-[#1C1917]">
                      {item.displayName}
                      <BadgeCheck className="w-4 h-4 text-[#1C1917]" aria-label="Verified purchase" />
                    </p>
                    {product && (
                      <button
                        type="button"
                        onClick={() => product.slug && onNavigate?.({ type: 'product', slug: product.slug })}
                        className="mt-2 text-sm text-[#57534E] hover:text-[#1C1917] underline-offset-2 hover:underline cursor-pointer line-clamp-1"
                      >
                        {product.name}{item.products.length > 1 ? ` +${item.products.length - 1}` : ''}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="mt-8 text-center">
          <a
            href={buildStoreShareLink(stats.average, stats.count)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-[#25D366] text-white px-6 py-3 text-sm tracking-[0.12em] uppercase"
          >
            Share on WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
};
