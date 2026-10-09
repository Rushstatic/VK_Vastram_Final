import React from 'react';
import { Container } from '../ui/Container';
import { CRAFT_IMAGE, BANARASI_IMAGE, HERO_IMAGE } from '../../data/catalog';
import { Button } from '../ui/Button';
import { PageView } from '../../types';
import { useSiteSettings } from '../../hooks/useSiteSettings';

interface AboutPageProps {
  onNavigate: (page: PageView) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  const { settings } = useSiteSettings();
  const storeName = settings?.storeName || 'VK VASTRAM';

  return (
    <div className="bg-[#FAF8F5] py-10 sm:py-16">
      <Container size="narrow">
        {/* Header */}
        <div className="text-center space-y-3 mb-12 sm:mb-16">
          <span className="text-[11px] uppercase tracking-[0.25em] text-[#967029] font-medium block">
            Our Lineage & Vision
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#1C1917] font-normal leading-tight">
            Indian Heritage Translated into Modern Living.
          </h1>
        </div>

        {/* Hero Visual */}
        <div className="rounded-xs overflow-hidden bg-[#F4EFE6] border border-[#1C1917]/10 mb-12">
          <img
            src={HERO_IMAGE}
            alt={`${storeName} Handcrafted Heritage`}
            className="w-full aspect-[16/9] object-cover"
          />
        </div>

        {/* Narrative */}
        <div className="space-y-8 text-sm sm:text-base text-[#57534E] leading-relaxed font-normal">
          <p className="font-serif text-xl sm:text-2xl text-[#1C1917] leading-snug">
            {storeName} was founded on a simple conviction: classical Indian textile craft is not a relic of the past, but a living tradition that deserves modern appreciation.
          </p>
...

          <p>
            India’s textile heritage is unmatched in its diversity, depth, and mastery. From the intricate floral brocades of Varanasi to the temple borders of Kanchipuram and the delicate breathability of Chanderi, each region has perfected a distinctive dialogue between thread, loom, and artisan.
          </p>

          {/* Editorial Image Grid */}
          <div className="grid grid-cols-2 gap-4 my-10">
            <div className="rounded-xs overflow-hidden bg-[#EFE9DC] border border-[#1C1917]/10">
              <img
                src={CRAFT_IMAGE}
                alt="Pit loom weaving"
                className="w-full aspect-[4/3] object-cover"
              />
              <p className="p-2.5 text-[11px] text-[#78716C] bg-[#FAF8F5]">Traditional handloom shuttle & silk yarn</p>
            </div>
            <div className="rounded-xs overflow-hidden bg-[#EFE9DC] border border-[#1C1917]/10">
              <img
                src={BANARASI_IMAGE}
                alt="Pure silk handloom saree"
                className="w-full aspect-[4/3] object-cover"
              />
              <p className="p-2.5 text-[11px] text-[#78716C] bg-[#FAF8F5]">Handwoven Katan silk brocade</p>
            </div>
          </div>

          <h2 className="font-serif text-2xl text-[#1C1917] pt-4 font-normal">
            Purity of Materials & Fair Engagement
          </h2>

          <p>
            We eliminate synthetic blends from our flagship collections, choosing pure natural mulberry silk, unadulterated cotton, and authentic zari. We value patience over mass automation, honoring the weeks of skilled labor behind each individual drape.
          </p>

          <div className="pt-8 text-center">
            <Button
              variant="primary"
              size="lg"
              onClick={() => onNavigate({ type: 'collection', category: 'sarees' })}
            >
              Explore Our Handloom Catalog
            </Button>
          </div>
        </div>
      </Container>
    </div>
  );
};
