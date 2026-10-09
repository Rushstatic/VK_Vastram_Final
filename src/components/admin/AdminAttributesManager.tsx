import React, { useState, useEffect } from 'react';
import {
  Plus,
  Save,
  Trash2,
  Edit2,
  Check,
  X,
  Palette,
  Sparkles,
  RefreshCw,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import {
  CANONICAL_COLOR_DICTIONARY,
  CanonicalColor,
  ColorType,
  getSwatchBackground,
} from '../../lib/colorSystem';
import { ColorSwatch } from '../ui/ColorSwatch';
import { Button } from '../ui/Button';
import { MediaUploader } from './MediaUploader';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export const AdminAttributesManager: React.FC = () => {
  const [colors, setColors] = useState<CanonicalColor[]>(() =>
    Object.values(CANONICAL_COLOR_DICTIONARY).map((c, idx) => ({
      ...c,
      isActive: c.isActive !== false,
      sortOrder: c.sortOrder || idx + 1,
    }))
  );

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Modal / Form state for adding or editing
  const [editingColor, setEditingColor] = useState<CanonicalColor | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // New color form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<ColorType>('solid');
  const [formHexPrimary, setFormHexPrimary] = useState('#B88E3E');
  const [formHexSecondary, setFormHexSecondary] = useState('#78281F');
  const [formSwatchUrl, setFormSwatchUrl] = useState('');
  const [formFamily, setFormFamily] = useState('Artisanal');

  // Load colors from site_settings if available
  const loadColorsFromSettings = async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from('site_settings')
        .select('*')
        .eq('key', 'attributes')
        .single();

      if (data?.value?.colors && Array.isArray(data.value.colors)) {
        setColors(data.value.colors);
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadColorsFromSettings();
  }, []);

  const handleSaveColors = async (updatedColors: CanonicalColor[]) => {
    setSaving(true);
    setFeedback(null);
    if (isSupabaseConfigured()) {
      try {
        await (supabase as any).from('site_settings').upsert({
          key: 'attributes',
          value: { colors: updatedColors },
          updated_at: new Date().toISOString(),
        });
        setFeedback('Centralized color dictionary saved and synchronized.');
      } catch (err: any) {
        setFeedback(`Failed to save: ${err.message}`);
      }
    } else {
      setFeedback('Saved to memory.');
    }
    setSaving(false);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleStartCreate = () => {
    setFormName('');
    setFormType('solid');
    setFormHexPrimary('#B88E3E');
    setFormHexSecondary('#78281F');
    setFormSwatchUrl('');
    setFormFamily('Artisanal');
    setIsCreating(true);
    setEditingColor(null);
  };

  const handleStartEdit = (col: CanonicalColor) => {
    setFormName(col.displayName);
    setFormType(col.type);
    setFormHexPrimary(col.hexPrimary || col.hexCode);
    setFormHexSecondary(col.hexSecondary || '#78281F');
    setFormSwatchUrl(col.swatchImageUrl || '');
    setFormFamily(col.family || 'Artisanal');
    setEditingColor(col);
    setIsCreating(false);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const slug = formName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
    const newColor: CanonicalColor = {
      canonicalName: slug,
      displayName: formName.trim(),
      type: formType,
      hexCode: formHexPrimary,
      hexPrimary: formHexPrimary,
      hexSecondary: formType === 'dual' ? formHexSecondary : undefined,
      swatchImageUrl: formType === 'swatch' ? formSwatchUrl : undefined,
      family: formFamily,
      aliases: [formName.toLowerCase().trim()],
      isActive: true,
      sortOrder: editingColor ? editingColor.sortOrder : colors.length + 1,
    };

    let updated: CanonicalColor[];
    if (editingColor) {
      updated = colors.map((c) => (c.canonicalName === editingColor.canonicalName ? newColor : c));
    } else {
      updated = [...colors, newColor];
    }

    setColors(updated);
    handleSaveColors(updated);
    setIsCreating(false);
    setEditingColor(null);
  };

  const handleToggleActive = (canonicalName: string) => {
    const updated = colors.map((c) =>
      c.canonicalName === canonicalName ? { ...c, isActive: !c.isActive } : c
    );
    setColors(updated);
    handleSaveColors(updated);
  };

  const handleDeleteColor = (canonicalName: string) => {
    const updated = colors.filter((c) => c.canonicalName !== canonicalName);
    setColors(updated);
    handleSaveColors(updated);
  };

  return (
    <div className="bg-[#FAF8F5] p-6 rounded-xs border border-[#1C1917]/10 shadow-2xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#1C1917]/10 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-[#967029]" />
            <h2 className="font-serif text-lg text-[#1C1917] font-medium">
              Centralized Color & Textile Swatch Library
            </h2>
          </div>
          <p className="text-xs text-[#78716C] mt-1">
            Centrally manage master solid shades, dual-tone saree weave splits, and complex textile image swatches.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleStartCreate}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add New Tone
          </Button>
          <button
            type="button"
            onClick={loadColorsFromSettings}
            title="Reload colors"
            className="p-2 border border-[#1C1917]/15 rounded-xs hover:bg-[#F4EFE6] text-[#57534E] cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Modal / Form for Creating or Editing Color */}
      {(isCreating || editingColor) && (
        <form onSubmit={handleSaveForm} className="p-4 bg-[#F4EFE6] rounded-xs border border-[#1C1917]/15 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1C1917]/10 pb-2">
            <span className="font-serif text-sm font-medium text-[#1C1917]">
              {editingColor ? `Edit Color: ${editingColor.displayName}` : 'Create New Color Attribute'}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setEditingColor(null);
              }}
              className="text-[#78716C] hover:text-[#1C1917] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 text-xs">
            {/* Color Display Name */}
            <div className="sm:col-span-4">
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#78716C] mb-1">
                Display Name *
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Rani Pink or Gold + Maroon"
                className="w-full bg-[#FAF8F5] p-2 border border-[#1C1917]/15 rounded-xs text-[#1C1917]"
              />
            </div>

            {/* Color Type (Solid / Dual / Swatch) */}
            <div className="sm:col-span-4">
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#78716C] mb-1">
                Color Model *
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as ColorType)}
                className="w-full bg-[#FAF8F5] p-2 border border-[#1C1917]/15 rounded-xs text-[#1C1917] cursor-pointer"
              >
                <option value="solid">Type A — Solid Single Hue</option>
                <option value="dual">Type B — Dual / Multi-tone (50/50 Split)</option>
                <option value="swatch">Type C — Textile / Swatch Image</option>
              </select>
            </div>

            {/* Color Family */}
            <div className="sm:col-span-4">
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#78716C] mb-1">
                Color Family
              </label>
              <input
                type="text"
                value={formFamily}
                onChange={(e) => setFormFamily(e.target.value)}
                placeholder="e.g., Pink, Green, Dual Tone"
                className="w-full bg-[#FAF8F5] p-2 border border-[#1C1917]/15 rounded-xs text-[#1C1917]"
              />
            </div>

            {/* Primary Hex */}
            <div className="sm:col-span-4">
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#78716C] mb-1">
                Primary Hex Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formHexPrimary}
                  onChange={(e) => setFormHexPrimary(e.target.value)}
                  className="w-8 h-8 rounded-full border border-[#1C1917]/20 cursor-pointer p-0 shrink-0"
                />
                <input
                  type="text"
                  value={formHexPrimary}
                  onChange={(e) => setFormHexPrimary(e.target.value)}
                  className="flex-1 bg-[#FAF8F5] p-2 border border-[#1C1917]/15 rounded-xs text-[#1C1917] font-mono text-[11px]"
                />
              </div>
            </div>

            {/* Secondary Hex (Dual only) */}
            {formType === 'dual' && (
              <div className="sm:col-span-4">
                <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#78716C] mb-1">
                  Secondary Hex (Border / Accent)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formHexSecondary}
                    onChange={(e) => setFormHexSecondary(e.target.value)}
                    className="w-8 h-8 rounded-full border border-[#1C1917]/20 cursor-pointer p-0 shrink-0"
                  />
                  <input
                    type="text"
                    value={formHexSecondary}
                    onChange={(e) => setFormHexSecondary(e.target.value)}
                    className="flex-1 bg-[#FAF8F5] p-2 border border-[#1C1917]/15 rounded-xs text-[#1C1917] font-mono text-[11px]"
                  />
                </div>
              </div>
            )}

            {/* Swatch Image Uploader (Swatch only) */}
            {formType === 'swatch' && (
              <div className="sm:col-span-8">
                <MediaUploader
                  label="Textile Swatch Image"
                  value={formSwatchUrl}
                  onChange={(url) => setFormSwatchUrl(url)}
                  folder="banners"
                  recommendedSize="Recommended 120 × 120 px square swatch"
                />
              </div>
            )}

            {/* Live Preview Column */}
            <div className="sm:col-span-4 flex flex-col justify-center items-center p-3 bg-[#FAF8F5] rounded-xs border border-[#1C1917]/10">
              <span className="text-[10px] uppercase tracking-wider text-[#78716C] font-semibold mb-2">
                Live Swatch Preview
              </span>
              <ColorSwatch
                colorName={formName || 'Sample'}
                hexPrimary={formHexPrimary}
                hexSecondary={formHexSecondary}
                swatchImageUrl={formType === 'swatch' ? formSwatchUrl : undefined}
                size="lg"
                showLabel={true}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#1C1917]/10">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsCreating(false);
                setEditingColor(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" leftIcon={<Save className="w-3.5 h-3.5" />}>
              Save to Library
            </Button>
          </div>
        </form>
      )}

      {/* Grid of All Centralized Colors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {colors.map((col) => {
          const bg = getSwatchBackground(col);
          return (
            <div
              key={col.canonicalName}
              className={`p-3 bg-[#FAF8F5] rounded-xs border flex items-center justify-between gap-3 text-xs transition-colors ${
                col.isActive ? 'border-[#1C1917]/15' : 'border-dashed border-[#1C1917]/20 opacity-50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Visual Swatch Circle */}
                <span
                  className="w-7 h-7 rounded-full border border-[#1C1917]/20 shrink-0 shadow-2xs"
                  style={{ background: bg }}
                />
                <div className="min-w-0">
                  <div className="font-medium text-[#1C1917] truncate">{col.displayName}</div>
                  <div className="text-[10px] text-[#78716C] flex items-center gap-1.5 font-mono">
                    <span className="capitalize">{col.type}</span>
                    <span>·</span>
                    <span>{col.family}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleActive(col.canonicalName)}
                  title={col.isActive ? 'Deactivate tone' : 'Activate tone'}
                  className={`px-2 py-1 text-[10px] rounded-2xs font-medium cursor-pointer ${
                    col.isActive
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-[#F4EFE6] text-[#78716C] hover:bg-[#EFE9DC]'
                  }`}
                >
                  {col.isActive ? 'Active' : 'Disabled'}
                </button>
                <button
                  type="button"
                  onClick={() => handleStartEdit(col)}
                  className="p-1 text-[#78716C] hover:text-[#1C1917] rounded-xs cursor-pointer"
                  title="Edit tone"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteColor(col.canonicalName)}
                  className="p-1 text-[#78716C] hover:text-red-700 rounded-xs cursor-pointer"
                  title="Delete from library"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
