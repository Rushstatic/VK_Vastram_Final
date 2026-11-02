import React, { useEffect, useState } from 'react';
import { Star, BadgeCheck } from 'lucide-react';
import { buildStoreShareLink } from '../../lib/reviewShare';

interface Quote {
  id: string;
  feedback: string;
  displayName: string;
  overallRating: number;
  photos?: string[];
}

const Stars: React.FC<{ value: number }> = ({ value }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} className={`w-4 h-4 ${n <= Math.round(value) ? 'fill-[#B88E3E] text-[#B88E3E]' : 'text-[#D6CFC2]'}`} />
    ))}
  </span>
);

/**
 * Common ratings block below the hero: one overall rating, a tagline, a few customer quotes and a
 * WhatsApp share link. Shows nothing until there are real reviews.
 */
export const ReviewsShowcase: React.FC = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [stats, setStats] = useState<{ average: number; count: number }>({ average: 0, count: 0 });

  useEffect(() => {
    let active = true;
    fetch('/api/reviews/showcase')
      .then((r) => r.json())
      .then((data) => {
        if (!active || !data?.success) return;
        setQuotes(Array.isArray(data.items) ? data.items.filter((i: Quote) => i.feedback).slice(0, 3) : []);
        setStats(data.stats || { average: 0, count: 0 });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (stats.count === 0 || quotes.length === 0) return null;

  return (
    <section aria-labelledby="ratings-heading" className="bg-[#F4EFE6] py-12 sm:py-16">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#B88E3E]">Loved by our customers</p>
          <h2 id="ratings-heading" className="font-serif text-3xl sm:text-4xl text-[#1C1917] mt-3">
            What our loved customers are saying
          </h2>
          <div className="mt-5 flex flex-col items-center gap-2">
            <p className="font-serif text-5xl text-[#78281F]">{stats.average.toFixed(1)}</p>
            <Stars value={stats.average} />
            <p className="text-sm text-[#57534E]">Average of {stats.count} customer {stats.count === 1 ? 'rating' : 'ratings'}</p>
          </div>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {quotes.map((q) => (
            <figure key={q.id} className="bg-[#FAF8F5] border border-[#1C1917]/10 p-6">
              <Stars value={q.overallRating || 5} />
              {q.photos && q.photos.length > 0 && (
                <div className="mt-4 flex gap-2">
                  {q.photos.slice(0, 3).map((src) => (
                    <img key={src} src={src} alt="Photo shared by a customer" loading="lazy" decoding="async" className="w-16 h-16 object-cover border border-[#1C1917]/10" />
                  ))}
                </div>
              )}
              <blockquote className="font-serif text-base leading-relaxed text-[#1C1917] mt-4">“{q.feedback}”</blockquote>
              <figcaption className="mt-4 flex items-center justify-between text-xs text-[#57534E]">
                <span className="font-medium text-[#1C1917]">{q.displayName}</span>
                <span className="inline-flex items-center gap-1 text-[#2F5D3A]"><BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" /> Verified</span>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-10 text-center">
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
