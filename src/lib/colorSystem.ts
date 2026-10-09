/**
 * Canonical Color Dictionary and Utility for VK VASTRAM
 * Ensures consistent color representation, swatch rendering,
 * and variant inventory binding across the storefront.
 */

/**
 * Canonical Color Dictionary and Centralized Attribute System for VK VASTRAM
 * Supports:
 * - Type A: Solid (hexPrimary)
 * - Type B: Dual / Multi-tone (hexPrimary + hexSecondary with 50/50 sharp split)
 * - Type C: Textile / Image Swatch (swatchImageUrl)
 */

export type ColorType = 'solid' | 'dual' | 'swatch';

export interface CanonicalColor {
  canonicalName: string;
  displayName: string;
  type: ColorType;
  hexCode: string; // Primary hex for fallback/main
  hexPrimary?: string;
  hexSecondary?: string;
  swatchImageUrl?: string;
  family: string;
  aliases: string[];
  isMulticolor?: boolean;
  gradient?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export const CANONICAL_COLOR_DICTIONARY: Record<string, CanonicalColor> = {
  // --- TYPE A: SOLIDS ---
  rani_pink: {
    canonicalName: 'rani_pink',
    displayName: 'Rani Pink',
    type: 'solid',
    hexCode: '#D81B60',
    hexPrimary: '#D81B60',
    family: 'Pink',
    aliases: ['rani pink', 'ranipink', 'baby pink', 'babypink', 'hot pink', 'rose pink', 'fuchsia'],
    sortOrder: 1,
  },
  royal_magenta: {
    canonicalName: 'royal_magenta',
    displayName: 'Royal Magenta',
    type: 'solid',
    hexCode: '#8E1B54',
    hexPrimary: '#8E1B54',
    family: 'Pink & Magenta',
    aliases: ['royal magenta', 'magenta', 'deep magenta'],
    sortOrder: 2,
  },
  deep_wine: {
    canonicalName: 'deep_wine',
    displayName: 'Deep Wine',
    type: 'solid',
    hexCode: '#5C1D2C',
    hexPrimary: '#5C1D2C',
    family: 'Wine & Maroon',
    aliases: ['deep wine', 'deepwine', 'wine', 'burgundy', 'maroon', 'plum'],
    sortOrder: 3,
  },
  crimson_red: {
    canonicalName: 'crimson_red',
    displayName: 'Crimson Red',
    type: 'solid',
    hexCode: '#9E1B32',
    hexPrimary: '#9E1B32',
    family: 'Red',
    aliases: ['crimson red', 'crimson', 'kashmiri red', 'red', 'sindoor', 'ruby'],
    sortOrder: 4,
  },
  emerald_green: {
    canonicalName: 'emerald_green',
    displayName: 'Emerald Green',
    type: 'solid',
    hexCode: '#1B4D3E',
    hexPrimary: '#1B4D3E',
    family: 'Green',
    aliases: ['emerald green', 'emeraldgreen', 'emerald', 'dark green', 'bottle green'],
    sortOrder: 5,
  },
  bottle_green: {
    canonicalName: 'bottle_green',
    displayName: 'Bottle Green',
    type: 'solid',
    hexCode: '#004225',
    hexPrimary: '#004225',
    family: 'Green',
    aliases: ['bottle green', 'dark bottle green', 'deep green'],
    sortOrder: 6,
  },
  peacock_blue: {
    canonicalName: 'peacock_blue',
    displayName: 'Peacock Blue',
    type: 'solid',
    hexCode: '#005B5C',
    hexPrimary: '#005B5C',
    family: 'Blue',
    aliases: ['peacock blue', 'peacock', 'teal blue', 'mor-pankh', 'teal'],
    sortOrder: 7,
  },
  royal_navy: {
    canonicalName: 'royal_navy',
    displayName: 'Royal Navy',
    type: 'solid',
    hexCode: '#1B2A4A',
    hexPrimary: '#1B2A4A',
    family: 'Blue',
    aliases: ['royal navy', 'navy blue', 'navy', 'midnight blue', 'dark blue'],
    sortOrder: 8,
  },
  indigo: {
    canonicalName: 'indigo',
    displayName: 'Indigo',
    type: 'solid',
    hexCode: '#2B3E50',
    hexPrimary: '#2B3E50',
    family: 'Blue',
    aliases: ['indigo', 'indigo blue', 'deep indigo'],
    sortOrder: 9,
  },
  royal_purple: {
    canonicalName: 'royal_purple',
    displayName: 'Royal Purple',
    type: 'solid',
    hexCode: '#4A154B',
    hexPrimary: '#4A154B',
    family: 'Purple',
    aliases: ['royal purple', 'purple', 'violet', 'jamuni'],
    sortOrder: 10,
  },
  lavender: {
    canonicalName: 'lavender',
    displayName: 'Lavender',
    type: 'solid',
    hexCode: '#B8A9C9',
    hexPrimary: '#B8A9C9',
    family: 'Purple',
    aliases: ['lavender', 'light purple', 'lilac'],
    sortOrder: 11,
  },
  ivory: {
    canonicalName: 'ivory',
    displayName: 'Ivory',
    type: 'solid',
    hexCode: '#FFFFF0',
    hexPrimary: '#FFFFF0',
    family: 'White & Cream',
    aliases: ['ivory', 'off-white', 'off white', 'cream', 'natural ivory'],
    sortOrder: 12,
  },
  ivory_blush: {
    canonicalName: 'ivory_blush',
    displayName: 'Ivory Blush',
    type: 'solid',
    hexCode: '#F7E7CE',
    hexPrimary: '#F7E7CE',
    family: 'White & Cream',
    aliases: ['ivory blush', 'blush', 'ivory cream', 'natural cream', 'natural unbleached cream'],
    sortOrder: 13,
  },
  warm_beige: {
    canonicalName: 'warm_beige',
    displayName: 'Warm Beige',
    type: 'solid',
    hexCode: '#E8D8C3',
    hexPrimary: '#E8D8C3',
    family: 'Beige & Earth',
    aliases: ['warm beige', 'beige', 'natural honey beige', 'honey beige'],
    sortOrder: 14,
  },
  pearl_beige: {
    canonicalName: 'pearl_beige',
    displayName: 'Pearl Beige',
    type: 'solid',
    hexCode: '#EAE3D2',
    hexPrimary: '#EAE3D2',
    family: 'Beige & Earth',
    aliases: ['pearl beige', 'pearl', 'oyster'],
    sortOrder: 15,
  },
  warm_sandstone: {
    canonicalName: 'warm_sandstone',
    displayName: 'Warm Sandstone',
    type: 'solid',
    hexCode: '#C8B195',
    hexPrimary: '#C8B195',
    family: 'Beige & Earth',
    aliases: ['warm sandstone', 'sandstone', 'earthy taupe', 'taupe'],
    sortOrder: 16,
  },
  mustard_ochre: {
    canonicalName: 'mustard_ochre',
    displayName: 'Mustard Ochre',
    type: 'solid',
    hexCode: '#D49B28',
    hexPrimary: '#D49B28',
    family: 'Gold & Yellow',
    aliases: ['mustard ochre', 'mustard', 'ochre', 'haldi yellow', 'haldi', 'yellow'],
    sortOrder: 17,
  },
  antique_gold: {
    canonicalName: 'antique_gold',
    displayName: 'Antique Gold',
    type: 'solid',
    hexCode: '#D4AF37',
    hexPrimary: '#D4AF37',
    family: 'Gold & Yellow',
    aliases: ['antique gold', 'zari gold', 'gold', 'pale gold', 'golden'],
    sortOrder: 18,
  },
  terracotta: {
    canonicalName: 'terracotta',
    displayName: 'Terracotta',
    type: 'solid',
    hexCode: '#C85A32',
    hexPrimary: '#C85A32',
    family: 'Orange & Rust',
    aliases: ['terracotta', 'muted terracotta', 'rust', 'brick red', 'orange'],
    sortOrder: 19,
  },
  pastel_peach: {
    canonicalName: 'pastel_peach',
    displayName: 'Pastel Peach',
    type: 'solid',
    hexCode: '#F5CBA7',
    hexPrimary: '#F5CBA7',
    family: 'Peach & Coral',
    aliases: ['pastel peach', 'blush peach', 'peach'],
    sortOrder: 20,
  },
  soft_pink: {
    canonicalName: 'soft_pink',
    displayName: 'Soft Pink',
    type: 'solid',
    hexCode: '#F4C2C2',
    hexPrimary: '#F4C2C2',
    family: 'Pink',
    aliases: ['soft pink', 'powder pink', 'blush pink', 'pink'],
    sortOrder: 21,
  },
  bright_pink: {
    canonicalName: 'bright_pink',
    displayName: 'Bright Pink',
    type: 'solid',
    hexCode: '#FF1493',
    hexPrimary: '#FF1493',
    family: 'Pink',
    aliases: ['bright pink', 'hot pink', 'deep pink'],
    sortOrder: 22,
  },
  lime_green: {
    canonicalName: 'lime_green',
    displayName: 'Lime Green',
    type: 'solid',
    hexCode: '#99B858',
    hexPrimary: '#99B858',
    family: 'Green',
    aliases: ['lime green', 'lime', 'parrot green'],
    sortOrder: 23,
  },
  olive_sage: {
    canonicalName: 'olive_sage',
    displayName: 'Olive Sage',
    type: 'solid',
    hexCode: '#6B705C',
    hexPrimary: '#6B705C',
    family: 'Green',
    aliases: ['olive sage', 'olive', 'sage', 'pistachio mist', 'pistachio', 'pista green'],
    sortOrder: 24,
  },
  mint_green: {
    canonicalName: 'mint_green',
    displayName: 'Mint Green',
    type: 'solid',
    hexCode: '#98DBC6',
    hexPrimary: '#98DBC6',
    family: 'Green',
    aliases: ['mint green', 'mint', 'seafoam'],
    sortOrder: 25,
  },
  aqua_turquoise: {
    canonicalName: 'aqua_turquoise',
    displayName: 'Aqua Turquoise',
    type: 'solid',
    hexCode: '#20B2AA',
    hexPrimary: '#20B2AA',
    family: 'Blue',
    aliases: ['aqua turquoise', 'turquoise', 'aqua'],
    sortOrder: 26,
  },
  charcoal_grey: {
    canonicalName: 'charcoal_grey',
    displayName: 'Charcoal Grey',
    type: 'solid',
    hexCode: '#36454F',
    hexPrimary: '#36454F',
    family: 'Grey & Black',
    aliases: ['charcoal grey', 'charcoal', 'grey', 'gray', 'black'],
    sortOrder: 27,
  },

  // --- TYPE B: DUAL / MULTI-TONE SAREE WEAVES ---
  beige_magenta: {
    canonicalName: 'beige_magenta',
    displayName: 'Beige + Magenta',
    type: 'dual',
    hexCode: '#E8D8C3',
    hexPrimary: '#E8D8C3',
    hexSecondary: '#8E1B54',
    family: 'Dual Tone',
    aliases: ['beige + magenta', 'beige & magenta', 'beige magenta'],
    isMulticolor: true,
    gradient: 'linear-gradient(135deg, #E8D8C3 0%, #E8D8C3 50%, #8E1B54 50%, #8E1B54 100%)',
    sortOrder: 28,
  },
  green_pink: {
    canonicalName: 'green_pink',
    displayName: 'Green + Pink',
    type: 'dual',
    hexCode: '#1B4D3E',
    hexPrimary: '#1B4D3E',
    hexSecondary: '#D81B60',
    family: 'Dual Tone',
    aliases: ['green + pink', 'green & pink', 'bottle green + rani pink'],
    isMulticolor: true,
    gradient: 'linear-gradient(135deg, #1B4D3E 0%, #1B4D3E 50%, #D81B60 50%, #D81B60 100%)',
    sortOrder: 29,
  },
  gold_maroon: {
    canonicalName: 'gold_maroon',
    displayName: 'Gold + Maroon',
    type: 'dual',
    hexCode: '#D4AF37',
    hexPrimary: '#D4AF37',
    hexSecondary: '#5C1D2C',
    family: 'Dual Tone',
    aliases: ['gold + maroon', 'gold & maroon', 'zari gold + deep wine'],
    isMulticolor: true,
    gradient: 'linear-gradient(135deg, #D4AF37 0%, #D4AF37 50%, #5C1D2C 50%, #5C1D2C 100%)',
    sortOrder: 30,
  },
  pearl_beige_teal: {
    canonicalName: 'pearl_beige_teal',
    displayName: 'Pearl Beige / Teal',
    type: 'dual',
    hexCode: '#EAE3D2',
    hexPrimary: '#EAE3D2',
    hexSecondary: '#005B5C',
    family: 'Dual Tone',
    aliases: ['pearl beige / teal', 'pearl beige & teal', 'pearl beige + teal'],
    isMulticolor: true,
    gradient: 'linear-gradient(135deg, #EAE3D2 0%, #EAE3D2 50%, #005B5C 50%, #005B5C 100%)',
    sortOrder: 31,
  },
  blush_pink_black: {
    canonicalName: 'blush_pink_black',
    displayName: 'Blush Pink / Black',
    type: 'dual',
    hexCode: '#F4C2C2',
    hexPrimary: '#F4C2C2',
    hexSecondary: '#1C1917',
    family: 'Dual Tone',
    aliases: ['blush pink / black', 'blush pink & black', 'blush pink + black'],
    isMulticolor: true,
    gradient: 'linear-gradient(135deg, #F4C2C2 0%, #F4C2C2 50%, #1C1917 50%, #1C1917 100%)',
    sortOrder: 32,
  },
  rose_pink_black: {
    canonicalName: 'rose_pink_black',
    displayName: 'Rose Pink / Black',
    type: 'dual',
    hexCode: '#E07A94',
    hexPrimary: '#E07A94',
    hexSecondary: '#1C1917',
    family: 'Dual Tone',
    aliases: ['rose pink / black', 'rose pink & black', 'rose pink + black'],
    isMulticolor: true,
    gradient: 'linear-gradient(135deg, #E07A94 0%, #E07A94 50%, #1C1917 50%, #1C1917 100%)',
    sortOrder: 33,
  },
  pink_teal: {
    canonicalName: 'pink_teal',
    displayName: 'Pink / Teal',
    type: 'dual',
    hexCode: '#D81B60',
    hexPrimary: '#D81B60',
    hexSecondary: '#005B5C',
    family: 'Dual Tone',
    aliases: ['pink / teal', 'pink & teal', 'pink + teal'],
    isMulticolor: true,
    gradient: 'linear-gradient(135deg, #D81B60 0%, #D81B60 50%, #005B5C 50%, #005B5C 100%)',
    sortOrder: 34,
  },
  teal_gold: {
    canonicalName: 'teal_gold',
    displayName: 'Teal / Gold',
    type: 'dual',
    hexCode: '#005B5C',
    hexPrimary: '#005B5C',
    hexSecondary: '#D4AF37',
    family: 'Dual Tone',
    aliases: ['teal / gold', 'teal & gold', 'teal + gold'],
    isMulticolor: true,
    gradient: 'linear-gradient(135deg, #005B5C 0%, #005B5C 50%, #D4AF37 50%, #D4AF37 100%)',
    sortOrder: 35,
  },
  lavender_purple: {
    canonicalName: 'lavender_purple',
    displayName: 'Lavender / Purple',
    type: 'dual',
    hexCode: '#B8A9C9',
    hexPrimary: '#B8A9C9',
    hexSecondary: '#4A154B',
    family: 'Dual Tone',
    aliases: ['lavender / purple', 'lavender & purple', 'lavender + purple'],
    isMulticolor: true,
    gradient: 'linear-gradient(135deg, #B8A9C9 0%, #B8A9C9 50%, #4A154B 50%, #4A154B 100%)',
    sortOrder: 36,
  },
  teal_rose: {
    canonicalName: 'teal_rose',
    displayName: 'Teal / Rose',
    type: 'dual',
    hexCode: '#005B5C',
    hexPrimary: '#005B5C',
    hexSecondary: '#E07A94',
    family: 'Dual Tone',
    aliases: ['teal / rose', 'teal & rose', 'teal + rose'],
    isMulticolor: true,
    gradient: 'linear-gradient(135deg, #005B5C 0%, #005B5C 50%, #E07A94 50%, #E07A94 100%)',
    sortOrder: 37,
  },
  lavender_yellow: {
    canonicalName: 'lavender_yellow',
    displayName: 'Lavender / Yellow',
    type: 'dual',
    hexCode: '#B8A9C9',
    hexPrimary: '#B8A9C9',
    hexSecondary: '#D49B28',
    family: 'Dual Tone',
    aliases: ['lavender / yellow', 'lavender & yellow', 'lavender + yellow'],
    isMulticolor: true,
    gradient: 'linear-gradient(135deg, #B8A9C9 0%, #B8A9C9 50%, #D49B28 50%, #D49B28 100%)',
    sortOrder: 38,
  },
  peach_gold: {
    canonicalName: 'peach_gold',
    displayName: 'Peach / Gold',
    type: 'dual',
    hexCode: '#F5CBA7',
    hexPrimary: '#F5CBA7',
    hexSecondary: '#D4AF37',
    family: 'Dual Tone',
    aliases: ['peach / gold', 'peach & gold', 'peach + gold'],
    isMulticolor: true,
    gradient: 'linear-gradient(135deg, #F5CBA7 0%, #F5CBA7 50%, #D4AF37 50%, #D4AF37 100%)',
    sortOrder: 39,
  },
  mint_aqua: {
    canonicalName: 'mint_aqua',
    displayName: 'Mint / Aqua',
    type: 'dual',
    hexCode: '#98DBC6',
    hexPrimary: '#98DBC6',
    hexSecondary: '#20B2AA',
    family: 'Dual Tone',
    aliases: ['mint / aqua', 'mint & aqua', 'mint + aqua'],
    isMulticolor: true,
    gradient: 'linear-gradient(135deg, #98DBC6 0%, #98DBC6 50%, #20B2AA 50%, #20B2AA 100%)',
    sortOrder: 40,
  },
  indigo_sandstone: {
    canonicalName: 'indigo_sandstone',
    displayName: 'Indigo & Sandstone',
    type: 'dual',
    hexCode: '#2B3E50',
    hexPrimary: '#2B3E50',
    hexSecondary: '#C8B195',
    family: 'Dual Tone',
    aliases: ['indigo & sandstone', 'indigo + sandstone', 'indigo sandstone'],
    isMulticolor: true,
    gradient: 'linear-gradient(135deg, #2B3E50 0%, #2B3E50 50%, #C8B195 50%, #C8B195 100%)',
    sortOrder: 41,
  },
  indigo_ivory: {
    canonicalName: 'indigo_ivory',
    displayName: 'Indigo & Ivory',
    type: 'dual',
    hexCode: '#2B3E50',
    hexPrimary: '#2B3E50',
    hexSecondary: '#FFFFF0',
    family: 'Dual Tone',
    aliases: ['indigo & ivory', 'indigo + ivory', 'indigo ivory'],
    isMulticolor: true,
    gradient: 'linear-gradient(135deg, #2B3E50 0%, #2B3E50 50%, #FFFFF0 50%, #FFFFF0 100%)',
    sortOrder: 42,
  },

  // --- TYPE C: COMPLEX TEXTILE / MULTICOLOR ARTISANAL SWATCHES ---
  ivory_multicolor: {
    canonicalName: 'ivory_multicolor',
    displayName: 'Ivory / Multicolor',
    type: 'dual',
    hexCode: '#FFFFF0',
    hexPrimary: '#FFFFF0',
    hexSecondary: '#D4AF37',
    family: 'Textile Swatch',
    aliases: ['ivory / multicolor', 'ivory & multicolor', 'ivory multicolor'],
    isMulticolor: true,
    gradient: 'linear-gradient(135deg, #FFFFF0 0%, #FFFFF0 50%, #D4AF37 50%, #D4AF37 100%)',
    sortOrder: 43,
  },
  orange_multicolor: {
    canonicalName: 'orange_multicolor',
    displayName: 'Orange / Multicolor',
    type: 'dual',
    hexCode: '#C85A32',
    hexPrimary: '#C85A32',
    hexSecondary: '#D4AF37',
    family: 'Textile Swatch',
    aliases: ['orange / multicolor', 'orange & multicolor', 'orange multicolor'],
    isMulticolor: true,
    gradient: 'linear-gradient(135deg, #C85A32 0%, #C85A32 50%, #D4AF37 50%, #D4AF37 100%)',
    sortOrder: 44,
  },
  multicolor: {
    canonicalName: 'multicolor',
    displayName: 'Multicolor Traditional Motifs',
    type: 'dual',
    hexCode: '#D4AF37',
    hexPrimary: '#D4AF37',
    hexSecondary: '#8E1B54',
    family: 'Textile Swatch',
    aliases: ['multicolor', 'multi color', 'traditional motifs', 'multicolor traditional motifs'],
    isMulticolor: true,
    gradient: 'linear-gradient(135deg, #D4AF37 0%, #D4AF37 33%, #8E1B54 33%, #8E1B54 66%, #1B4D3E 66%, #1B4D3E 100%)',
    sortOrder: 45,
  },
};

const INVALID_COLOR_NAMES = new Set(['', '-', '—', 'null', 'undefined', 'n/a', 'na', 'unknown', 'none', 'natural textile']);

/**
 * Normalizes input raw color strings to a canonical representation.
 * Returns null if the color name is empty, missing, or meaningless.
 */
export function resolveCanonicalColor(
  rawColorName?: string | null,
  customPalette?: CanonicalColor[]
): CanonicalColor {
  if (!rawColorName || typeof rawColorName !== 'string') {
    return {
      canonicalName: 'unassigned',
      displayName: '',
      type: 'solid',
      hexCode: '#EFE8DA',
      family: 'Neutral',
      aliases: [],
    };
  }

  const clean = rawColorName.toLowerCase().trim().replace(/[-_]/g, ' ');

  if (INVALID_COLOR_NAMES.has(clean) || clean.length === 0) {
    return {
      canonicalName: 'unassigned',
      displayName: '',
      type: 'solid',
      hexCode: '#EFE8DA',
      family: 'Neutral',
      aliases: [],
    };
  }

  // 1. Direct exact canonicalName or displayName search in customPalette first if provided
  if (customPalette && customPalette.length > 0) {
    for (const c of customPalette) {
      if (
        c.canonicalName === clean ||
        c.displayName.toLowerCase() === clean ||
        c.aliases?.some((a) => a.toLowerCase() === clean)
      ) {
        return c;
      }
    }
  }

  // 2. Direct exact match in dictionary (canonicalName, displayName, or exact alias)
  for (const key of Object.keys(CANONICAL_COLOR_DICTIONARY)) {
    const entry = CANONICAL_COLOR_DICTIONARY[key];
    if (
      entry.canonicalName === clean ||
      entry.displayName.toLowerCase() === clean ||
      entry.aliases.some((alias) => alias.toLowerCase() === clean)
    ) {
      return entry;
    }
  }

  // 3. Multicolored combo detection (e.g. "Green + Pink", "Pearl Beige / Teal", "Gold + Maroon")
  if (clean.includes('&') || clean.includes('/') || clean.includes('+')) {
    const parts = clean.split(/[&/+]/).map((p) => p.trim());
    const color1 = parts[0] ? resolveCanonicalColor(parts[0], customPalette) : null;
    const color2 = parts[1] ? resolveCanonicalColor(parts[1], customPalette) : null;

    const hex1 = color1?.hexPrimary || color1?.hexCode || '#E8D8C3';
    const hex2 = color2?.hexPrimary || color2?.hexCode || '#78281F';

    return {
      canonicalName: clean.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
      displayName: rawColorName.trim(),
      type: 'dual',
      hexCode: hex1,
      hexPrimary: hex1,
      hexSecondary: hex2,
      family: 'Dual Tone',
      aliases: [clean],
      isMulticolor: true,
      gradient: `linear-gradient(135deg, ${hex1} 0%, ${hex1} 50%, ${hex2} 50%, ${hex2} 100%)`,
    };
  }

  // 4. Substring alias search as secondary fallback (only for single color terms)
  for (const key of Object.keys(CANONICAL_COLOR_DICTIONARY)) {
    const entry = CANONICAL_COLOR_DICTIONARY[key];
    if (entry.aliases.some((alias) => alias.length >= 4 && clean.includes(alias.toLowerCase()))) {
      return entry;
    }
  }

  // Human readable display name for explicit custom color
  const formatted = rawColorName
    .trim()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  return {
    canonicalName: clean.replace(/\s+/g, '_'),
    displayName: formatted,
    type: 'solid',
    hexCode: '#C5A059',
    hexPrimary: '#C5A059',
    family: 'Artisanal',
    aliases: [clean],
  };
}

/**
 * Generates the CSS background string for any CanonicalColor.
 */
export function getSwatchBackground(color: CanonicalColor): string {
  if (color.type === 'swatch' && color.swatchImageUrl) {
    return `url("${color.swatchImageUrl}") center/cover no-repeat`;
  }
  if (color.type === 'dual' && color.hexPrimary && color.hexSecondary) {
    return `linear-gradient(135deg, ${color.hexPrimary} 0%, ${color.hexPrimary} 50%, ${color.hexSecondary} 50%, ${color.hexSecondary} 100%)`;
  }
  if (color.gradient) {
    return color.gradient;
  }
  return color.hexPrimary || color.hexCode;
}

/**
 * Returns unique canonical colors present across an array of products.
 * Never creates or returns unassigned or empty colors.
 */
export function getAvailableColorsFromProducts(products: { colors?: string[] }[]): CanonicalColor[] {
  const map = new Map<string, CanonicalColor>();

  products.forEach((p) => {
    if (Array.isArray(p.colors)) {
      p.colors.forEach((c) => {
        if (!c || typeof c !== 'string' || !c.trim()) return;
        const canonical = resolveCanonicalColor(c);
        if (canonical && canonical.displayName && canonical.canonicalName !== 'unassigned') {
          if (!map.has(canonical.canonicalName)) {
            map.set(canonical.canonicalName, canonical);
          }
        }
      });
    }
  });

  return Array.from(map.values());
}
