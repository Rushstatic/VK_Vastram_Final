import React, { useState, useEffect } from 'react';
import {
  Home,
  Save,
  CheckCircle2,
  RefreshCw,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Flame,
} from 'lucide-react';
import { adminService, HomepageSectionData, HeroSlide } from '../../services/adminService';
import { Button } from '../ui/Button';
import { MediaUploader } from './MediaUploader';
import { ImageAdjustmentControl } from './ImageAdjustmentControl';

export const AdminHomepage: React.FC = () => {
  const [sections, setSections] = useState<HomepageSectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [expandedSlideIndex, setExpandedSlideIndex] = useState<number | null>(0);

  const fetchSections = async () => {
    setLoading(true);
    const data = await adminService.getHomepageSections();
    setSections(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchSections();
  }, []);

  const handleUpdateField = (id: string, field: keyof HomepageSectionData, value: any) => {
    setSections(
      sections.map((sec) => (sec.id === id ? { ...sec, [field]: value } : sec))
    );
  };

  const handleUpdateHeroContent = (id: string, newContent: Record<string, any>) => {
    setSections(
      sections.map((sec) => (sec.id === id ? { ...sec, content: newContent } : sec))
    );
  };

  // Helper to ensure hero slides exist
  const getHeroSlides = (sec: HomepageSectionData): HeroSlide[] => {
    if (Array.isArray(sec.content?.slides) && sec.content.slides.length > 0) {
      return sec.content.slides;
    }

    // Default legacy slide 1
    return [
      {
        id: 'slide-1',
        desktopImage: sec.imageUrl || '',
        mobileImage: sec.mobileImageUrl || '',
        eyebrow: 'The Heritage Loom',
        heading: sec.title || 'Timeless Indian Textiles for Modern Living.',
        description:
          sec.subtitle ||
          'Authentic handwoven sarees, pure katan silks, and breathable organic cotton bedsheets—crafted with generational patience and pure materials.',
        primaryCtaText: sec.buttonText || 'Explore Sarees',
        primaryCtaUrl: sec.buttonUrl || '/sarees',
        secondaryCtaText: 'Shop Bedsheets',
        secondaryCtaUrl: '/bedsheets',
        badge: sec.content?.badge || 'Crimson & Temple Zari Bridal Kanjivaram',
        sortOrder: 1,
        isActive: true,
      },
    ];
  };

  const handleAddHeroSlide = (sec: HomepageSectionData) => {
    const currentSlides = getHeroSlides(sec);
    if (currentSlides.length >= 5) return;

    const newIndex = currentSlides.length + 1;
    const newSlide: HeroSlide = {
      id: `slide-${Date.now()}`,
      desktopImage: '',
      mobileImage: '',
      eyebrow: 'Festive Collection',
      heading: `Curated Heritage Edit ${newIndex}`,
      description: 'Handcrafted weaves celebrating master artisan clusters across India.',
      primaryCtaText: 'Explore Collection',
      primaryCtaUrl: '/sarees',
      secondaryCtaText: 'Shop Bedsheets',
      secondaryCtaUrl: '/bedsheets',
      badge: 'Handloom Pure Silk Motif',
      sortOrder: newIndex,
      isActive: true,
    };

    const updatedSlides = [...currentSlides, newSlide];
    handleUpdateHeroContent(sec.id, {
      ...sec.content,
      slides: updatedSlides,
    });
    setExpandedSlideIndex(updatedSlides.length - 1);
  };

  const handleUpdateSlideField = (
    sec: HomepageSectionData,
    slideIndex: number,
    field: keyof HeroSlide,
    value: any
  ) => {
    const currentSlides = [...getHeroSlides(sec)];
    if (!currentSlides[slideIndex]) return;

    currentSlides[slideIndex] = {
      ...currentSlides[slideIndex],
      [field]: value,
    };

    // If updating first slide, also keep root properties in sync for backward compatibility
    const updatedContent: Record<string, any> = {
      ...sec.content,
      slides: currentSlides,
    };

    if (slideIndex === 0) {
      if (field === 'desktopImage') sec.imageUrl = value;
      if (field === 'mobileImage') sec.mobileImageUrl = value;
      if (field === 'heading') sec.title = value;
      if (field === 'description') sec.subtitle = value;
      if (field === 'primaryCtaText') sec.buttonText = value;
      if (field === 'primaryCtaUrl') sec.buttonUrl = value;
      if (field === 'badge') updatedContent.badge = value;
    }

    handleUpdateHeroContent(sec.id, updatedContent);
  };

  const handleMoveSlide = (sec: HomepageSectionData, index: number, direction: 'up' | 'down') => {
    const currentSlides = [...getHeroSlides(sec)];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= currentSlides.length) return;

    const temp = currentSlides[index];
    currentSlides[index] = currentSlides[targetIndex];
    currentSlides[targetIndex] = temp;

    // Recalculate sortOrder
    const reordered = currentSlides.map((s, idx) => ({ ...s, sortOrder: idx + 1 }));

    handleUpdateHeroContent(sec.id, {
      ...sec.content,
      slides: reordered,
    });
    setExpandedSlideIndex(targetIndex);
  };

  const handleRemoveSlide = (sec: HomepageSectionData, index: number) => {
    const currentSlides = [...getHeroSlides(sec)];
    if (currentSlides.length <= 1) return;

    currentSlides.splice(index, 1);
    const reordered = currentSlides.map((s, idx) => ({ ...s, sortOrder: idx + 1 }));

    handleUpdateHeroContent(sec.id, {
      ...sec.content,
      slides: reordered,
    });
    setExpandedSlideIndex(Math.max(0, index - 1));
  };

  const handleSaveSection = async (sec: HomepageSectionData) => {
    setSavingId(sec.id);
    setFeedback(null);

    // Sync root fields from slide 1 for hero sections
    const payload: HomepageSectionData = { ...sec };
    if (sec.sectionType === 'hero') {
      const slides = getHeroSlides(sec);
      const first = slides[0];
      if (first) {
        payload.imageUrl = first.desktopImage || sec.imageUrl;
        payload.mobileImageUrl = first.mobileImage || sec.mobileImageUrl;
        payload.title = first.heading || sec.title;
        payload.subtitle = first.description || sec.subtitle;
        payload.buttonText = first.primaryCtaText || sec.buttonText;
        payload.buttonUrl = first.primaryCtaUrl || sec.buttonUrl;
      }
      payload.content = {
        ...sec.content,
        slides,
      };
    }

    const success = await adminService.saveHomepageSection(sec.id, payload);
    setSavingId(null);
    if (success) {
      window.dispatchEvent(new CustomEvent('vk_homepage_updated'));
      setFeedback(`Section "${sec.title.slice(0, 25)}..." updated and synchronized across storefront.`);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#1C1917] font-normal">
            Homepage CMS & Banners
          </h1>
          <p className="text-xs text-[#57534E] mt-1">
            Configure multi-slide hero carousel, live sale indicator, category showcase headers, and editorial craftsmanship blocks.
          </p>
        </div>

        <button
          onClick={fetchSections}
          title="Refresh homepage CMS"
          className="p-2 bg-[#FAF8F5] border border-[#1C1917]/15 rounded-xs hover:bg-[#F4EFE6] text-[#57534E] transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {feedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{feedback}</span>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-xs text-[#78716C]">
          Loading homepage section blocks...
        </div>
      ) : (
        <div className="space-y-8">
          {sections.map((sec) => {
            const isHero = sec.sectionType === 'hero';
            const heroSlides = isHero ? getHeroSlides(sec) : [];
            const saleBadgeEnabled = Boolean(sec.content?.sale_badge_enabled);
            const saleBadgeText = sec.content?.sale_badge_text || 'SALE IS LIVE';

            return (
              <div
                key={sec.id}
                className="bg-[#FAF8F5] rounded-xs border border-[#1C1917]/10 p-6 shadow-2xs space-y-6"
              >
                {/* Section Title & Status */}
                <div className="flex items-center justify-between border-b border-[#1C1917]/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] uppercase tracking-wider font-semibold bg-[#F4EFE6] text-[#967029] px-2 py-0.5 rounded-xs">
                      {sec.sectionType}
                    </span>
                    <h2 className="font-serif text-base text-[#1C1917] font-medium">
                      {isHero
                        ? 'Hero Campaign Carousel & Banners'
                        : sec.sectionType === 'categories'
                        ? 'Category Showcase Header'
                        : 'Craftsmanship & Philosophy Block'}
                    </h2>
                  </div>

                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sec.isActive}
                      onChange={(e) => handleUpdateField(sec.id, 'isActive', e.target.checked)}
                      className="rounded-xs accent-[#B88E3E] w-4 h-4"
                    />
                    <span className="text-[#1C1917] font-medium">
                      {sec.isActive ? 'Active on Store' : 'Hidden'}
                    </span>
                  </label>
                </div>

                {/* ----------------- HERO SECTION MULTI-SLIDE EDITOR ----------------- */}
                {isHero ? (
                  <div className="space-y-6">
                    {/* Live Sale Indicator Card */}
                    <div className="p-4 bg-[#F4EFE6] border border-[#1C1917]/10 rounded-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Flame className="w-4 h-4 text-[#78281F]" />
                          <h3 className="text-xs font-semibold text-[#1C1917] uppercase tracking-wider">
                            Live Sale Indicator Overlay
                          </h3>
                        </div>
                        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={saleBadgeEnabled}
                            onChange={(e) =>
                              handleUpdateHeroContent(sec.id, {
                                ...sec.content,
                                sale_badge_enabled: e.target.checked,
                              })
                            }
                            className="rounded-xs accent-[#78281F] w-4 h-4"
                          />
                          <span className="font-medium text-[#1C1917]">
                            {saleBadgeEnabled ? 'Badge Visible' : 'Badge Hidden'}
                          </span>
                        </label>
                      </div>

                      {saleBadgeEnabled && (
                        <div className="pt-2 border-t border-[#1C1917]/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block font-medium text-[#1C1917] mb-1">
                              Badge Display Text
                            </label>
                            <input
                              type="text"
                              value={saleBadgeText}
                              onChange={(e) =>
                                handleUpdateHeroContent(sec.id, {
                                  ...sec.content,
                                  sale_badge_text: e.target.value,
                                })
                              }
                              placeholder="SALE IS LIVE"
                              className="w-full bg-[#FAF8F5] border border-[#1C1917]/15 p-2 rounded-xs"
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-5 text-[#57534E] text-[11px]">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Renders a subtle, non-intrusive pulsating indicator over the hero visual.</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Slides Manager Header */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[#967029]" />
                        <h3 className="font-serif text-sm font-medium text-[#1C1917]">
                          Hero Slides ({heroSlides.length}/5)
                        </h3>
                        {heroSlides.length > 1 && (
                          <span className="text-[11px] text-[#78716C]">
                            · Auto-transitions every 5.5s with crossfade
                          </span>
                        )}
                      </div>

                      {heroSlides.length < 5 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddHeroSlide(sec)}
                          leftIcon={<Plus className="w-3.5 h-3.5" />}
                          className="text-xs"
                        >
                          Add Hero Slide
                        </Button>
                      )}
                    </div>

                    {/* Slides List */}
                    <div className="space-y-4">
                      {heroSlides.map((slide, slideIdx) => {
                        const isExpanded = expandedSlideIndex === slideIdx;

                        return (
                          <div
                            key={slide.id || slideIdx}
                            className={`border rounded-xs transition-colors ${
                              isExpanded
                                ? 'border-[#78281F]/40 bg-white/70 shadow-2xs'
                                : 'border-[#1C1917]/15 bg-[#FAF8F5] hover:bg-[#F4EFE6]/40'
                            }`}
                          >
                            {/* Slide Item Header / Bar */}
                            <div className="flex items-center justify-between p-3.5 select-none gap-2">
                              <div
                                onClick={() =>
                                  setExpandedSlideIndex(isExpanded ? null : slideIdx)
                                }
                                className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                              >
                                <span className="w-5 h-5 rounded-full bg-[#1C1917] text-[#FAF8F5] text-[10px] font-mono flex items-center justify-center shrink-0">
                                  {slideIdx + 1}
                                </span>

                                {/* Slide Thumbnail */}
                                {slide.desktopImage ? (
                                  <img
                                    src={slide.desktopImage}
                                    alt="Slide thumbnail"
                                    className="w-10 h-7 object-cover rounded-xs border border-[#1C1917]/10 shrink-0 bg-[#F4EFE6]"
                                  />
                                ) : (
                                  <div className="w-10 h-7 rounded-xs border border-dashed border-[#1C1917]/20 flex items-center justify-center shrink-0 bg-[#F4EFE6] text-[9px] text-[#A8A29E]">
                                    No Img
                                  </div>
                                )}

                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-[#1C1917] truncate">
                                    {slide.heading || 'Untitled Slide'}
                                  </p>
                                  <p className="text-[10px] text-[#78716C] truncate">
                                    {slide.eyebrow || 'The Heritage Loom'} · {slide.primaryCtaText || 'Explore Sarees'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {/* Slide Active Toggle */}
                                <label className="flex items-center gap-1.5 text-[11px] cursor-pointer mr-2 select-none">
                                  <input
                                    type="checkbox"
                                    checked={slide.isActive !== false}
                                    onChange={(e) =>
                                      handleUpdateSlideField(
                                        sec,
                                        slideIdx,
                                        'isActive',
                                        e.target.checked
                                      )
                                    }
                                    className="rounded-xs accent-[#B88E3E] w-3.5 h-3.5"
                                  />
                                  <span className="text-[#57534E]">
                                    {slide.isActive !== false ? 'Active' : 'Disabled'}
                                  </span>
                                </label>

                                {/* Reorder Controls */}
                                <button
                                  type="button"
                                  disabled={slideIdx === 0}
                                  onClick={() => handleMoveSlide(sec, slideIdx, 'up')}
                                  title="Move slide up"
                                  className="p-1 text-[#57534E] hover:text-[#1C1917] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={slideIdx === heroSlides.length - 1}
                                  onClick={() => handleMoveSlide(sec, slideIdx, 'down')}
                                  title="Move slide down"
                                  className="p-1 text-[#57534E] hover:text-[#1C1917] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>

                                {/* Delete Slide (if > 1 slide) */}
                                {heroSlides.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSlide(sec, slideIdx)}
                                    title="Delete this slide"
                                    className="p-1 text-[#78716C] hover:text-red-700 cursor-pointer ml-1"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Expand/Collapse arrow */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedSlideIndex(isExpanded ? null : slideIdx)
                                  }
                                  className="p-1 text-[#78716C] hover:text-[#1C1917] cursor-pointer ml-1"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Slide Body / Form Fields */}
                            {isExpanded && (
                              <div className="p-4 border-t border-[#1C1917]/10 space-y-4 text-xs bg-[#FAF8F5]/80">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Eyebrow */}
                                  <div>
                                    <label className="block font-semibold text-[#1C1917] mb-1">
                                      Eyebrow Tag
                                    </label>
                                    <input
                                      type="text"
                                      value={slide.eyebrow || ''}
                                      onChange={(e) =>
                                        handleUpdateSlideField(
                                          sec,
                                          slideIdx,
                                          'eyebrow',
                                          e.target.value
                                        )
                                      }
                                      placeholder="e.g., The Heritage Loom"
                                      className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs"
                                    />
                                  </div>

                                  {/* Headline */}
                                  <div className="md:col-span-2">
                                    <label className="block font-semibold text-[#1C1917] mb-1">
                                      Slide Headline *
                                    </label>
                                    <input
                                      type="text"
                                      value={slide.heading}
                                      onChange={(e) =>
                                        handleUpdateSlideField(
                                          sec,
                                          slideIdx,
                                          'heading',
                                          e.target.value
                                        )
                                      }
                                      placeholder="e.g., Timeless Indian Textiles for Modern Living."
                                      className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs text-[#1C1917]"
                                    />
                                  </div>

                                  {/* Description */}
                                  <div className="md:col-span-2">
                                    <label className="block font-semibold text-[#1C1917] mb-1">
                                      Slide Description / Supporting Narrative
                                    </label>
                                    <textarea
                                      rows={2}
                                      value={slide.description}
                                      onChange={(e) =>
                                        handleUpdateSlideField(
                                          sec,
                                          slideIdx,
                                          'description',
                                          e.target.value
                                        )
                                      }
                                      className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs text-[#1C1917]"
                                    />
                                  </div>

                                  {/* Desktop Visual Uploader */}
                                  <div>
                                    <MediaUploader
                                      label="Desktop Slide Image (4:3 or 16:10 ratio)"
                                      value={slide.desktopImage}
                                      onChange={(url) =>
                                        handleUpdateSlideField(
                                          sec,
                                          slideIdx,
                                          'desktopImage',
                                          url
                                        )
                                      }
                                      folder="homepage"
                                    />
                                  </div>

                                  {/* Mobile Visual Uploader */}
                                  <div>
                                    <MediaUploader
                                      label="Mobile Slide Image (Optional)"
                                      value={slide.mobileImage || ''}
                                      onChange={(url) =>
                                        handleUpdateSlideField(
                                          sec,
                                          slideIdx,
                                          'mobileImage',
                                          url
                                        )
                                      }
                                      folder="homepage"
                                    />
                                  </div>

                                  {/* Reusable Image Presentation Control with Live Visual Preview */}
                                  <div className="md:col-span-2 mt-1">
                                    <ImageAdjustmentControl
                                      imageUrl={slide.desktopImage}
                                      fit={slide.fit || 'cover'}
                                      focalPositionX={slide.focalPositionX || 'center'}
                                      focalPositionY={slide.focalPositionY || 'center'}
                                      scale={slide.scale || 1.0}
                                      onChange={(settings) => {
                                        handleUpdateSlideField(sec, slideIdx, 'fit', settings.fit);
                                        handleUpdateSlideField(sec, slideIdx, 'focalPositionX', settings.focalPositionX);
                                        handleUpdateSlideField(sec, slideIdx, 'focalPositionY', settings.focalPositionY);
                                        handleUpdateSlideField(sec, slideIdx, 'scale', settings.scale);
                                      }}
                                      title="Slide Presentation & Focal Tuning (Single-Source)"
                                    />
                                  </div>

                                  {/* Primary CTA */}
                                  <div>
                                    <label className="block font-semibold text-[#1C1917] mb-1">
                                      Primary CTA Label
                                    </label>
                                    <input
                                      type="text"
                                      value={slide.primaryCtaText}
                                      onChange={(e) =>
                                        handleUpdateSlideField(
                                          sec,
                                          slideIdx,
                                          'primaryCtaText',
                                          e.target.value
                                        )
                                      }
                                      placeholder="e.g., Explore Sarees"
                                      className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs"
                                    />
                                  </div>

                                  <div>
                                    <label className="block font-semibold text-[#1C1917] mb-1">
                                      Primary CTA Destination
                                    </label>
                                    <input
                                      type="text"
                                      value={slide.primaryCtaUrl}
                                      onChange={(e) =>
                                        handleUpdateSlideField(
                                          sec,
                                          slideIdx,
                                          'primaryCtaUrl',
                                          e.target.value
                                        )
                                      }
                                      placeholder="/sarees, /bedsheets, /about"
                                      className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs font-mono text-[11px]"
                                    />
                                  </div>

                                  {/* Secondary CTA */}
                                  <div>
                                    <label className="block font-semibold text-[#1C1917] mb-1">
                                      Secondary CTA Label (Optional)
                                    </label>
                                    <input
                                      type="text"
                                      value={slide.secondaryCtaText || ''}
                                      onChange={(e) =>
                                        handleUpdateSlideField(
                                          sec,
                                          slideIdx,
                                          'secondaryCtaText',
                                          e.target.value
                                        )
                                      }
                                      placeholder="e.g., Shop Bedsheets"
                                      className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs"
                                    />
                                  </div>

                                  <div>
                                    <label className="block font-semibold text-[#1C1917] mb-1">
                                      Secondary CTA Destination (Optional)
                                    </label>
                                    <input
                                      type="text"
                                      value={slide.secondaryCtaUrl || ''}
                                      onChange={(e) =>
                                        handleUpdateSlideField(
                                          sec,
                                          slideIdx,
                                          'secondaryCtaUrl',
                                          e.target.value
                                        )
                                      }
                                      placeholder="/bedsheets, /about"
                                      className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs font-mono text-[11px]"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* ----------------- STANDARD SECTION EDITOR (Categories & Philosophy) ----------------- */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="md:col-span-2">
                      <label className="block font-semibold text-[#1C1917] mb-1">
                        Editorial Headline *
                      </label>
                      <input
                        type="text"
                        value={sec.title}
                        onChange={(e) => handleUpdateField(sec.id, 'title', e.target.value)}
                        className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2.5 rounded-xs text-[#1C1917]"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block font-semibold text-[#1C1917] mb-1">
                        Supporting Copy
                      </label>
                      <textarea
                        rows={2}
                        value={sec.subtitle}
                        onChange={(e) => handleUpdateField(sec.id, 'subtitle', e.target.value)}
                        className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2.5 rounded-xs text-[#1C1917]"
                      />
                    </div>

                    <div>
                      <MediaUploader
                        label="Desktop Visual"
                        value={sec.imageUrl}
                        onChange={(url) => handleUpdateField(sec.id, 'imageUrl', url)}
                        folder="homepage"
                      />
                    </div>

                    <div>
                      <MediaUploader
                        label="Mobile Visual (Optional)"
                        value={sec.mobileImageUrl || ''}
                        onChange={(url) => handleUpdateField(sec.id, 'mobileImageUrl', url)}
                        folder="homepage"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#1C1917] mb-1">
                        CTA Button Label
                      </label>
                      <input
                        type="text"
                        value={sec.buttonText}
                        onChange={(e) =>
                          handleUpdateField(sec.id, 'buttonText', e.target.value)
                        }
                        placeholder="e.g., Read Our Story"
                        className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#1C1917] mb-1">
                        CTA Destination URL
                      </label>
                      <input
                        type="text"
                        value={sec.buttonUrl}
                        onChange={(e) =>
                          handleUpdateField(sec.id, 'buttonUrl', e.target.value)
                        }
                        placeholder="/about, /sarees"
                        className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs font-mono text-[11px]"
                      />
                    </div>
                  </div>
                )}

                {/* Save Section Button */}
                <div className="flex justify-end pt-3 border-t border-[#1C1917]/10">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSaveSection(sec)}
                    disabled={savingId === sec.id}
                    leftIcon={<Save className="w-3.5 h-3.5" />}
                  >
                    {savingId === sec.id ? 'Saving Section...' : 'Save Section'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
