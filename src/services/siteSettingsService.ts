import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface SiteSettingsData {
  storeName: string;
  tagline: string;
  taglineColor?: string;
  taglineEmojis?: string;
  thankYouNote?: string;
  logoUrl?: string;
  supportEmail: string;
  supportPhone: string;
  whatsappNumber: string;
  studioAddress: string;
  announcementBarText: string;
  freeShippingThreshold: number;
  exchangeWindowDays: number;
  dispatchWindowHours: string;
  codMaxLimit: number;
  currency: string;
  currencySymbol: string;
}

const DEFAULT_SETTINGS: SiteSettingsData = {
  storeName: 'VK VASTRAM',
  tagline: 'Classical Indian Textiles & Sarees',
  taglineColor: '#967029',
  taglineEmojis: '✨🧵',
  thankYouNote: 'Thank you for patronizing VK VASTRAM',
  logoUrl: '',
  supportEmail: 'care@vkvastram.com',
  supportPhone: '+91 98234 56789',
  whatsappNumber: '+91 98234 56789',
  studioAddress: 'VK Vastram Design Pavilion, Jayanagar Heritage Enclave, Bengaluru, Karnataka 560041',
  announcementBarText: 'Shipping charges calculated at checkout.',
  freeShippingThreshold: 0,
  exchangeWindowDays: 7,
  dispatchWindowHours: '24-48',
  codMaxLimit: 15000,
  currency: 'INR',
  currencySymbol: '₹',
};

export const siteSettingsService = {
  async getSettings(): Promise<SiteSettingsData> {
    if (!isSupabaseConfigured()) {
      return DEFAULT_SETTINGS;
    }

    try {
      const { data, error } = await (supabase as any)
        .from('site_settings')
        .select('*');

      if (error || !data) {
        return DEFAULT_SETTINGS;
      }

      const genRow = data.find((row: any) => row.key === 'general');
      const polRow = data.find((row: any) => row.key === 'policies');

      const gen = genRow?.value || {};
      const pol = polRow?.value || {};

      return {
        storeName: gen.store_name || DEFAULT_SETTINGS.storeName,
        tagline: gen.tagline || DEFAULT_SETTINGS.tagline,
        taglineColor: gen.tagline_color || DEFAULT_SETTINGS.taglineColor,
        taglineEmojis: gen.tagline_emojis || DEFAULT_SETTINGS.taglineEmojis,
        thankYouNote: gen.thank_you_note || DEFAULT_SETTINGS.thankYouNote,
        logoUrl: gen.logo_url || DEFAULT_SETTINGS.logoUrl,
        supportEmail: gen.support_email || DEFAULT_SETTINGS.supportEmail,
        supportPhone: gen.support_phone || DEFAULT_SETTINGS.supportPhone,
        whatsappNumber: gen.whatsapp_number || DEFAULT_SETTINGS.whatsappNumber,
        studioAddress: gen.studio_address || DEFAULT_SETTINGS.studioAddress,
        announcementBarText: gen.announcement_bar_text || DEFAULT_SETTINGS.announcementBarText,
        freeShippingThreshold: gen.free_shipping_threshold ?? DEFAULT_SETTINGS.freeShippingThreshold,
        exchangeWindowDays: pol.exchange_window_days ?? DEFAULT_SETTINGS.exchangeWindowDays,
        dispatchWindowHours: pol.dispatch_window_hours || DEFAULT_SETTINGS.dispatchWindowHours,
        codMaxLimit: pol.cod_max_limit ?? DEFAULT_SETTINGS.codMaxLimit,
        currency: pol.currency || DEFAULT_SETTINGS.currency,
        currencySymbol: pol.currency_symbol || DEFAULT_SETTINGS.currencySymbol,
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  },
};
