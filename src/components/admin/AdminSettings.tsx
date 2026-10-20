import React, { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle2, RefreshCw, Shield, X, Palette } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { MediaUploader } from './MediaUploader';
import { AdminAttributesManager } from './AdminAttributesManager';

interface GeneralSettings {
  store_name: string;
  tagline: string;
  tagline_color?: string;
  tagline_emojis?: string;
  thank_you_note?: string;
  logo_url?: string;
  instagram_url?: string;
  facebook_url?: string;
  support_email: string;
  support_phone: string;
  whatsapp_number: string;
  studio_address: string;
  gstin: string;
  announcement_bar_text: string;
  free_shipping_threshold: number;
  fall_pico_price: number;
  maharashtra_shipping: number;
  other_state_shipping: number;
}

interface PolicySettings {
  exchange_window_days: number;
  dispatch_window_hours: string;
  cod_max_limit: number;
  cod_enabled: boolean;
  currency: string;
}

export const AdminSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'attributes'>('general');
  const [general, setGeneral] = useState<GeneralSettings>({
    store_name: 'VK VASTRAM',
    tagline: 'Classical Indian Textiles & Sarees',
    tagline_color: '#967029',
    tagline_emojis: '✨🧵',
    thank_you_note: 'Thank you for patronizing VK VASTRAM',
    logo_url: '',
    instagram_url: '',
    facebook_url: '',
    support_email: 'care@vkvastram.com',
    support_phone: '+91 98234 56789',
    whatsapp_number: '+91 98234 56789',
    studio_address: 'VK Vastram Design Pavilion, Jayanagar Heritage Enclave, Bengaluru, Karnataka 560041',
    gstin: '',
    announcement_bar_text: 'Authentic Handwoven Sarees & Pure Cotton Living Textiles · Generational Craftsmanship',
    free_shipping_threshold: 1999,
    fall_pico_price: 0,
    maharashtra_shipping: 100,
    other_state_shipping: 150,
  });

  const [policies, setPolicies] = useState<PolicySettings>({
    exchange_window_days: 7,
    dispatch_window_hours: '24-48',
    cod_max_limit: 15000,
    cod_enabled: false,
    currency: 'INR',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await (supabase as any).from('site_settings').select('*');
      if (data) {
        const genRow = data.find((row: any) => row.key === 'general');
        if (genRow?.value) setGeneral((prev) => ({ ...prev, ...genRow.value, free_shipping_threshold: genRow.value.free_shipping_threshold ?? prev.free_shipping_threshold }));

        const polRow = data.find((row: any) => row.key === 'policies');
        if (polRow?.value) setPolicies({ cod_enabled: false, ...polRow.value });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedGstin = (general.gstin || '').trim().toUpperCase();
    if (normalizedGstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(normalizedGstin)) {
      setFeedback('Enter a valid 15-character GSTIN, or leave the field blank until registration is complete.');
      return;
    }
    setGeneral((prev) => ({ ...prev, gstin: normalizedGstin }));
    setSaving(true);
    setFeedback(null);

    let savedSuccessfully = false;

    if (isSupabaseConfigured()) {
      try {
        const session = await supabase.auth.getSession();
        const token = session.data?.session?.access_token || '';

        const res = await fetch('/api/admin/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ general: { ...general, gstin: normalizedGstin }, policies }),
        });

        if (res.ok) {
          const resData = await res.json();
          if (resData.success) {
            savedSuccessfully = true;
          }
        }
      } catch (err) {
        console.warn('Backend settings endpoint error, attempting direct client upsert:', err);
      }

      if (!savedSuccessfully) {
        try {
          const results = await Promise.all([
            (supabase as any).from('site_settings').upsert({
              key: 'general',
              value: { ...general, gstin: normalizedGstin },
              updated_at: new Date().toISOString(),
            }),
            (supabase as any).from('site_settings').upsert({
              key: 'policies',
              value: policies,
              updated_at: new Date().toISOString(),
            }),
          ]);

          const hasError = results.some((r) => r.error);
          if (!hasError) {
            savedSuccessfully = true;
          }
        } catch (clientErr) {
          console.error('Direct upsert error:', clientErr);
        }
      }
    } else {
      savedSuccessfully = true;
    }

    // Verify the persisted policy row before announcing success or broadcasting a
    // checkout update. This catches backend/RLS/configuration failures that otherwise
    // leave checkout showing stale COD availability.
    if (savedSuccessfully && isSupabaseConfigured()) {
      try {
        const { data: persistedRow, error: verifyError } = await (supabase as any)
          .from('site_settings')
          .select('value')
          .eq('key', 'policies')
          .maybeSingle();
        if (verifyError || !persistedRow?.value || persistedRow.value.cod_enabled !== (policies.cod_enabled === true)) {
          savedSuccessfully = false;
          setFeedback('Settings were not confirmed in the database. Please retry and check admin permissions.');
        }
      } catch {
        savedSuccessfully = false;
        setFeedback('Could not verify saved settings. Please reload and check the database connection.');
      }
    }

    setSaving(false);

    if (savedSuccessfully) {
      // Broadcast update across the entire client application
      const updatedSiteSettings = {
        storeName: general.store_name,
        tagline: general.tagline,
        taglineColor: general.tagline_color || '#967029',
        taglineEmojis: general.tagline_emojis || '✨🧵',
        thankYouNote: general.thank_you_note || 'Thank you for patronizing VK VASTRAM',
        logoUrl: general.logo_url || '',
        instagramUrl: (general.instagram_url || '').trim(),
        facebookUrl: (general.facebook_url || '').trim(),
        supportEmail: general.support_email,
        supportPhone: general.support_phone,
        whatsappNumber: general.whatsapp_number,
        studioAddress: general.studio_address,
        gstin: normalizedGstin,
        announcementBarText: general.announcement_bar_text,
        freeShippingThreshold: general.free_shipping_threshold,
        exchangeWindowDays: policies.exchange_window_days,
        dispatchWindowHours: policies.dispatch_window_hours,
        codMaxLimit: policies.cod_max_limit,
        codEnabled: policies.cod_enabled === true,
        currency: policies.currency,
        currencySymbol: '₹',
      };

      window.dispatchEvent(
        new CustomEvent('vk_settings_updated', {
          detail: updatedSiteSettings,
        })
      );

      setFeedback('Store settings updated and synchronized across all client touchpoints.');
    } else {
      setFeedback('Failed to save settings. Please verify administrator permissions.');
    }

    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#1C1917] font-normal">
            Business Settings & Policies
          </h1>
          <p className="text-xs text-[#57534E] mt-1">
            Centrally manage contact points, announcement bar messages, and store policies.
          </p>
        </div>

        <button
          onClick={fetchSettings}
          title="Reload settings"
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

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1C1917]/10 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-xs transition-colors cursor-pointer ${
            activeTab === 'general'
              ? 'bg-[#1C1917] text-[#FAF8F5]'
              : 'bg-[#FAF8F5] text-[#57534E] hover:text-[#1C1917]'
          }`}
        >
          Store Identity & Policies
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('attributes')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-xs transition-colors cursor-pointer ${
            activeTab === 'attributes'
              ? 'bg-[#1C1917] text-[#FAF8F5]'
              : 'bg-[#FAF8F5] text-[#57534E] hover:text-[#1C1917]'
          }`}
        >
          <Palette className="w-3.5 h-3.5 text-[#B88E3E]" />
          <span>Colors & Swatch Attributes</span>
        </button>
      </div>

      {activeTab === 'attributes' ? (
        <AdminAttributesManager />
      ) : (
        <form onSubmit={handleSaveAll} className="space-y-6">
        {/* Section 1: Store & Contact Information */}
        <div className="bg-[#FAF8F5] p-6 rounded-xs border border-[#1C1917]/10 shadow-2xs space-y-5">
          <h2 className="font-serif text-base text-[#1C1917] font-medium border-b border-[#1C1917]/10 pb-3">
            Store Identity & Client Communication
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Logo Upload */}
            <div className="md:col-span-2">
              <MediaUploader
                label="Store Logo Image"
                value={general.logo_url}
                onChange={(url) => setGeneral({ ...general, logo_url: url })}
                folder="logo"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#1C1917] mb-1">Instagram Link</label>
              <input type="url" value={general.instagram_url || ''}
                onChange={(e) => setGeneral({ ...general, instagram_url: e.target.value })}
                placeholder="https://www.instagram.com/yourpage"
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs" />
            </div>

            <div>
              <label className="block font-semibold text-[#1C1917] mb-1">Facebook Link</label>
              <input type="url" value={general.facebook_url || ''}
                onChange={(e) => setGeneral({ ...general, facebook_url: e.target.value })}
                placeholder="https://www.facebook.com/yourpage"
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs" />
            </div>

            <div>
              <label className="block font-semibold text-[#1C1917] mb-1">
                Store Brand Name
              </label>
              <input
                type="text"
                required
                value={general.store_name}
                onChange={(e) => setGeneral({ ...general, store_name: e.target.value })}
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#1C1917] mb-1">Free Delivery Threshold (₹)</label>
              <input type="number" min="0" step="1" value={general.free_shipping_threshold ?? 1999}
                onChange={(e) => setGeneral({ ...general, free_shipping_threshold: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs" />
              <p className="mt-1 text-[10px] text-[#78716C]">Set 0 to disable the free-delivery threshold message.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">Fall & Pico Price (₹)</label>
                <input type="number" min="0" step="1" value={general.fall_pico_price ?? 0} onChange={(e) => setGeneral({ ...general, fall_pico_price: Math.max(0, Number(e.target.value) || 0) })} className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs" />
                <p className="mt-1 text-[10px] text-[#78716C]">0 means complimentary. Positive value is displayed on the product page.</p>
              </div>
              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">Maharashtra Shipping (₹)</label>
                <input type="number" min="0" step="1" value={general.maharashtra_shipping ?? 100} onChange={(e) => setGeneral({ ...general, maharashtra_shipping: Math.max(0, Number(e.target.value) || 0) })} className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs" />
              </div>
              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">Other States Shipping (₹)</label>
                <input type="number" min="0" step="1" value={general.other_state_shipping ?? 150} onChange={(e) => setGeneral({ ...general, other_state_shipping: Math.max(0, Number(e.target.value) || 0) })} className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs" />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#1C1917] mb-1">
                Tagline / Subtitle
              </label>
              <input
                type="text"
                value={general.tagline}
                onChange={(e) => setGeneral({ ...general, tagline: e.target.value })}
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#1C1917] mb-1">
                Tagline Hex Color
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={general.tagline_color || '#967029'}
                  onChange={(e) => setGeneral({ ...general, tagline_color: e.target.value })}
                  className="w-10 h-8 bg-transparent border border-[#1C1917]/15 cursor-pointer rounded-xs"
                />
                <input
                  type="text"
                  value={general.tagline_color || '#967029'}
                  onChange={(e) => setGeneral({ ...general, tagline_color: e.target.value })}
                  placeholder="#967029"
                  className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs font-mono uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#1C1917] mb-1">
                Tagline Emojis (✨ 🧵 🌸 etc.)
              </label>
              <input
                type="text"
                value={general.tagline_emojis || ''}
                onChange={(e) => setGeneral({ ...general, tagline_emojis: e.target.value })}
                placeholder="e.g. ✨🧵"
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-semibold text-[#1C1917] mb-1">
                Thank You Tagline / Note (For Downmost Order Section & PDF Invoice)
              </label>
              <input
                type="text"
                value={general.thank_you_note || ''}
                onChange={(e) => setGeneral({ ...general, thank_you_note: e.target.value })}
                placeholder="e.g. Thank you for patronizing VK VASTRAM"
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#1C1917] mb-1">
                Support Email
              </label>
              <input
                type="email"
                required
                value={general.support_email}
                onChange={(e) => setGeneral({ ...general, support_email: e.target.value })}
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#1C1917] mb-1">
                Phone & WhatsApp Number
              </label>
              <input
                type="text"
                required
                value={general.support_phone}
                onChange={(e) =>
                  setGeneral({
                    ...general,
                    support_phone: e.target.value,
                    whatsapp_number: e.target.value,
                  })
                }
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-semibold text-[#1C1917] mb-1">
                Design Pavilion / Studio Address
              </label>
              <input
                type="text"
                value={general.studio_address}
                onChange={(e) => setGeneral({ ...general, studio_address: e.target.value })}
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#1C1917] mb-1">GSTIN</label>
              <input
                type="text"
                value={general.gstin || ''}
                onChange={(e) => setGeneral({ ...general, gstin: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                placeholder="15-character GSTIN (optional)"
                maxLength={15}
                autoCapitalize="characters"
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs font-mono uppercase"
              />
              <p className="mt-1 text-[10px] text-[#78716C]">Printed on invoices when configured. Leave blank until a valid GSTIN is available.</p>
            </div>

            <div className="md:col-span-2">
              <label className="block font-semibold text-[#1C1917] mb-1">
                Storefront Top Announcement Bar Message
              </label>
              <input
                type="text"
                value={general.announcement_bar_text}
                onChange={(e) =>
                  setGeneral({ ...general, announcement_bar_text: e.target.value })
                }
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Store Operational Policies */}
        <div className="bg-[#FAF8F5] p-6 rounded-xs border border-[#1C1917]/10 shadow-2xs space-y-5">
          <h2 className="font-serif text-base text-[#1C1917] font-medium border-b border-[#1C1917]/10 pb-3">
            Operations & Policies
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-[#1C1917] mb-1">
                Exchange Window (Days)
              </label>
              <input
                type="number"
                min="0"
                value={policies.exchange_window_days}
                onChange={(e) =>
                  setPolicies({
                    ...policies,
                    exchange_window_days: Number(e.target.value),
                  })
                }
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs tabular-nums"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#1C1917] mb-1">
                Dispatch Window (Hours)
              </label>
              <input
                type="text"
                value={policies.dispatch_window_hours}
                onChange={(e) =>
                  setPolicies({
                    ...policies,
                    dispatch_window_hours: e.target.value,
                  })
                }
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs"
              />
            </div>

            <div className="sm:col-span-2 p-4 border border-[#1C1917]/10 rounded-xs bg-[#F4EFE6]/60">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <label htmlFor="cod-enabled" className="block font-semibold text-[#1C1917] mb-1">Cash on Delivery (COD)</label>
                  <p className="text-xs text-[#57534E]">Turn COD on only when your team is ready to fulfil cash orders.</p>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold">
                  <input id="cod-enabled" type="checkbox" checked={policies.cod_enabled === true} onChange={(e) => setPolicies({ ...policies, cod_enabled: e.target.checked })} className="h-4 w-4 accent-[#967029]" />
                  {policies.cod_enabled ? 'Enabled' : 'Disabled'}
                </label>
              </div>
              {!policies.cod_enabled && <p className="mt-2 text-xs text-[#800020]">Customer message: “COD is unavailable due to high demand.”</p>}
            </div>
            <div>
              <label className="block font-semibold text-[#1C1917] mb-1">
                Maximum COD Order Limit (₹)
              </label>
              <input
                type="number"
                min="0"
                value={policies.cod_max_limit}
                onChange={(e) =>
                  setPolicies({
                    ...policies,
                    cod_max_limit: Number(e.target.value),
                  })
                }
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* Security Assurance Card */}
        <div className="p-4 bg-[#F4EFE6] rounded-xs border border-[#1C1917]/10 text-xs text-[#57534E] flex items-center gap-3">
          <Shield className="w-5 h-5 text-[#967029] shrink-0" />
          <p>
            Service-role keys and administrative database credentials are secured on the server and are never exposed or editable through this client interface.
          </p>
        </div>

        {/* Save CTA */}
        <div className="flex justify-end pt-2">
          <Button
            variant="primary"
            size="md"
            type="submit"
            disabled={saving}
            leftIcon={<Save className="w-4 h-4" />}
          >
            {saving ? 'Saving Settings...' : 'Save All Settings'}
          </Button>
        </div>
      </form>
      )}
    </div>
  );
};
