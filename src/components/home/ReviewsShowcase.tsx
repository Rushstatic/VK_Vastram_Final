import React, { useEffect, useRef, useState } from 'react';
import { Star, ChevronLeft, ChevronRight, BadgeCheck, Quote } from 'lucide-react';
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

const Stars: React.FC<{ value: number }> = ({ value }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} className={`w-4 h-4 ${n <= Math.round(value) ? 'fill-[#B88E3E] text-[#B88E3E]' : 'text-[#D6CFC2]'}`} />
    ))}
  </span>
);

/**
 * Customer reviews on the homepage, above the trust section.
 * Image rules: the customer's photo is shown when there is one, otherwise the product's photo.
 * Images are never cropped: each keeps its own proportions, so products look as they really are.
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
            <Stars value={stats.average} />
            <span className="font-semibold">{stats.average.toFixed(2)}</span>
            <span aria-hidden="true">★</span>
            <span className="text-[#57534E]">({stats.count})</span>
          </div>
        </div>

        <div className="relative mt-10">
          <button type="button" onClick={() => slide(-1)} aria-label="Previous reviews"
            className="hidden sm:flex absolute -left-3 top-1/3 z-10 w-10 h-10 items-center justify-center bg-white border border-[#1C1917]/10 shadow-sm hover:bg-[#FAF8F5] cursor-pointer">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => slide(1)} aria-label="Next reviews"
            className="hidden sm:flex absolute -right-3 top-1/3 z-10 w-10 h-10 items-center justify-center bg-white border border-[#1C1917]/10 shadow-sm hover:bg-[#FAF8F5] cursor-pointer">
            <ChevronRight className="w-5 h-5" />
          </button>

          <div ref={trackRef} className="flex items-start gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((item) => {
              const product = item.products[0];
              const customerPhoto = item.photos && item.photos.length > 0 ? item.photos[0] : '';
              const photo = customerPhoto || product?.image || '';
              const photoAlt = customerPhoto
                ? `Photo shared by ${item.displayName}`
                : product ? `${product.name}` : 'VK VASTRAM handloom saree';
              return (
                <article key={item.id} className="snap-start shrink-0 w-[80%] sm:w-[calc(33.333%-14px)] lg:w-[calc(25%-15px)] bg-[#FAF8F5] border border-[#1C1917]/10 flex flex-col">
                  {photo && (
                    <div className="bg-[#F4EFE6]">
                      {/* No cropping: the image keeps its own proportions. */}
                      <img src={photo} alt={photoAlt} loading="lazy" decoding="async" className="block w-full h-auto max-h-[460px] object-contain mx-auto" />
                    </div>
                  )}
                  <div className="flex flex-col flex-1 p-6">
                    <div className="flex items-start justify-between">
                      <Stars value={item.overallRating || 5} />
                      <Quote className="w-7 h-7 text-[#B88E3E]/30" aria-hidden="true" />
                    </div>
                    <p className="font-serif text-lg leading-relaxed text-[#1C1917] mt-4">“{item.feedback}”</p>
                    {product && (
                      <button type="button" onClick={() => product.slug && onNavigate?.({ type: 'product', slug: product.slug })}
                        className="mt-5 w-full text-left text-xs text-[#78281F] bg-[#F4EFE6] border border-[#B88E3E]/30 rounded-full px-4 py-2 hover:bg-[#EFE9DC] cursor-pointer">
                        {product.name}{item.products.length > 1 ? ` +${item.products.length - 1}` : ''} · {product.rating}★
                      </button>
                    )}
                    <div className="mt-auto pt-5 flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-[#1C1917]">{item.displayName}</span>
                      <span className="inline-flex items-center gap-1 text-[#2F5D3A] whitespace-nowrap text-xs">
                        <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" /> Verified purchase
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="mt-8 text-center">
          <a href={buildStoreShareLink(stats.average, stats.count)} target="_blank" rel="noopener noreferrer"
            className="inline-block bg-[#25D366] text-white px-6 py-3 text-sm tracking-[0.12em] uppercase">
            Share on WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
};
