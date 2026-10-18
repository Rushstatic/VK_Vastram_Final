import React, { useEffect, useState } from 'react';
import { Plus, Save, Trash2, RefreshCw } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { MediaUploader } from './MediaUploader';

type SareeType = { rowKey: string; name: string; active: boolean; imageUrl?: string; sortOrder?: number };
type FabricType = { rowKey: string; name: string; active: boolean; sortOrder: number; usageCount: number };
const DEFAULT_TYPES: SareeType[] = [
  { rowKey: 'default-chanderi', name: 'Chanderi', active: true, imageUrl: '' }, { rowKey: 'default-malmal', name: 'Malmal Cotton', active: true, imageUrl: '' },
  { rowKey: 'default-tissue', name: 'Tissue Silk', active: true, imageUrl: '' }, { rowKey: 'default-linen', name: 'Linen Cotton', active: true, imageUrl: '' },
  { rowKey: 'default-banarasi', name: 'Banarasi', active: true, imageUrl: '' }, { rowKey: 'default-kanjivaram', name: 'Kanjivaram', active: true, imageUrl: '' },
  { rowKey: 'default-paithani', name: 'Paithani', active: true, imageUrl: '' },
];
const DEFAULT_FABRICS = ['Malmal Cotton', 'Tissue Silk', 'Linen Cotton', 'Pure Silk', 'Katan Silk', 'Silk Cotton Blend', 'Cotton'];
const keyFor = (name: string, index: number) => `row-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

export const AdminSareeTypes: React.FC = () => {
  const [tab, setTab] = useState<'types' | 'fabrics'>('types');
  const [types, setTypes] = useState<SareeType[]>(DEFAULT_TYPES);
  const [fabrics, setFabrics] = useState<FabricType[]>(DEFAULT_FABRICS.map((name, i) => ({ rowKey: keyFor(name, i), name, active: true, sortOrder: i, usageCount: 0 })));
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(''); const [error, setError] = useState('');

  const load = async () => {
    if (!isSupabaseConfigured()) { setLoading(false); return; }
    const [{ data: typeData }, { data: fabricData }, { data: productData }] = await Promise.all([
      (supabase as any).from('site_settings').select('value').eq('key', 'saree_types').maybeSingle(),
      (supabase as any).from('site_settings').select('value').eq('key', 'fabric_types').maybeSingle(),
      (supabase as any).from('products').select('fabric'),
    ]);
    let storedTypes = typeData?.value;
    if (typeof storedTypes === 'string') { try { storedTypes = JSON.parse(storedTypes); } catch { storedTypes = null; } }
    if (Array.isArray(storedTypes?.types)) setTypes(storedTypes.types.filter((t: any) => t && typeof t.name === 'string').map((t: any, i: number) => ({ rowKey: keyFor(t.name, i), name: t.name, active: t.active !== false, imageUrl: typeof t.imageUrl === 'string' ? t.imageUrl : '', sortOrder: Number(t.sortOrder ?? i) })));
    let storedFabrics = fabricData?.value;
    if (typeof storedFabrics === 'string') { try { storedFabrics = JSON.parse(storedFabrics); } catch { storedFabrics = null; } }
    const usage = new Map<string, number>();
    (productData || []).forEach((p: any) => { if (typeof p.fabric === 'string' && p.fabric.trim()) usage.set(p.fabric.trim().toLowerCase(), (usage.get(p.fabric.trim().toLowerCase()) || 0) + 1); });
    if (Array.isArray(storedFabrics?.types)) setFabrics(storedFabrics.types.filter((t: any) => t && typeof t.name === 'string').map((t: any, i: number) => ({ rowKey: keyFor(t.name, i), name: t.name, active: t.active !== false, sortOrder: Number(t.sortOrder ?? i), usageCount: usage.get(t.name.trim().toLowerCase()) || 0 })));
    else setFabrics((old) => old.map((f) => ({ ...f, usageCount: usage.get(f.name.toLowerCase()) || 0 })));
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const saveTypes = async () => {
    setSaving(true); setMessage(''); setError('');
    const cleaned = types.map((t, i) => ({ name: t.name.trim(), active: t.active, sortOrder: Number(t.sortOrder ?? i), imageUrl: t.imageUrl || '' })).filter((t) => t.name);
    if (new Set(cleaned.map((t) => t.name.toLowerCase())).size !== cleaned.length) { setError('Saree type names must be unique.'); setSaving(false); return; }
    if (!isSupabaseConfigured()) { setError('Supabase is not configured; changes cannot sync across sessions.'); setSaving(false); return; }
    const { error } = await (supabase as any).from('site_settings').upsert({ key: 'saree_types', value: { types: cleaned }, updated_at: new Date().toISOString() });
    if (error) setError(`Save failed: ${error.message}`); else { setMessage('Saree types saved.'); window.dispatchEvent(new CustomEvent('vk_saree_types_updated')); }
    setSaving(false);
  };
  const saveFabrics = async () => {
    setSaving(true); setMessage(''); setError('');
    const cleaned = fabrics.map((f, i) => ({ name: f.name.trim(), active: f.active, sortOrder: i })).filter((f) => f.name);
    if (new Set(cleaned.map((f) => f.name.toLowerCase())).size !== cleaned.length) { setError('Fabric names must be unique (case-insensitive).'); setSaving(false); return; }
    const removedInUse = fabrics.some((f) => f.usageCount > 0 && !cleaned.some((n) => n.name.toLowerCase() === f.name.toLowerCase()));
    if (removedInUse) { setError('A fabric used by products cannot be deleted. Deactivate it instead.'); setSaving(false); return; }
    if (!isSupabaseConfigured()) { setError('Supabase is not configured; changes cannot sync across sessions.'); setSaving(false); return; }
    const { error } = await (supabase as any).from('site_settings').upsert({ key: 'fabric_types', value: { types: cleaned }, updated_at: new Date().toISOString() });
    if (error) setError(`Save failed: ${error.message}`); else { setMessage('Fabric list saved.'); window.dispatchEvent(new CustomEvent('vk_fabric_types_updated')); void load(); }
    setSaving(false);
  };

  return <div className="max-w-4xl mx-auto space-y-5 text-[#1C1917]">
    <header><h1 className="font-serif text-3xl">Saree Attributes</h1><p className="text-sm text-[#78716C] mt-1">Manage the taxonomy used by product forms, navigation and catalogue filters.</p></header>
    <div className="flex gap-2 border-b border-[#1C1917]/15 pb-2"><button type="button" onClick={() => { setTab('types'); setMessage(''); setError(''); }} className={`px-4 py-2 text-sm ${tab === 'types' ? 'bg-[#78281F] text-white' : 'border border-[#1C1917]/15'}`}>Saree Types</button><button type="button" onClick={() => { setTab('fabrics'); setMessage(''); setError(''); }} className={`px-4 py-2 text-sm ${tab === 'fabrics' ? 'bg-[#78281F] text-white' : 'border border-[#1C1917]/15'}`}>Fabrics</button></div>
    {loading ? <p className="text-sm">Loading saved attributes…</p> : tab === 'types' ? <div className="space-y-3">{types.map((t, i) => <div key={t.rowKey} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-3 items-center border border-[#1C1917]/15 p-3 bg-[#FAF8F5]"><input value={t.name} onChange={e => setTypes(old => old.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="min-w-0 border p-2 bg-white" aria-label={`Saree type ${i + 1}`} /><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={t.active} onChange={e => setTypes(old => old.map((x, j) => j === i ? { ...x, active: e.target.checked } : x))} /> Active</label><button type="button" title="Remove unsaved row" onClick={() => setTypes(old => old.filter((_, j) => j !== i))} className="p-2 text-red-700"><Trash2 size={16} /></button><div className="sm:col-span-3 border-t border-[#1C1917]/10 pt-3"><MediaUploader label={`${t.name || 'Saree type'} circle image`} value={t.imageUrl || ''} onChange={url => setTypes(old => old.map((x, j) => j === i ? { ...x, imageUrl: url } : x))} folder="categories" recommendedSize="Recommended 800 × 800 px · Square crop for Saree Traditions" /></div></div>)}<div className="flex flex-wrap gap-3"><button type="button" onClick={() => setTypes(old => [...old, { rowKey: `new-${Date.now()}-${old.length}`, name: '', active: true, imageUrl: '' }])} className="border border-[#1C1917]/20 px-4 py-2 flex items-center gap-2"><Plus size={16} /> Add type</button><button type="button" disabled={saving} onClick={saveTypes} className="bg-[#78281F] text-white px-4 py-2 flex items-center gap-2 disabled:opacity-50">{saving ? <RefreshCw size={16} /> : <Save size={16} />} Save types</button></div></div> : <div className="space-y-3">{fabrics.map((f, i) => <div key={f.rowKey} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-3 items-center border border-[#1C1917]/15 p-3 bg-[#FAF8F5]"><div><input value={f.name} onChange={e => setFabrics(old => old.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="w-full border p-2 bg-white" aria-label={`Fabric ${i + 1}`} /><p className="text-xs text-[#78716C] mt-1">Used by {f.usageCount} product(s)</p></div><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.active} onChange={e => setFabrics(old => old.map((x, j) => j === i ? { ...x, active: e.target.checked } : x))} /> Active</label><button type="button" disabled={f.usageCount > 0} title={f.usageCount > 0 ? 'Deactivate this fabric because products use it' : 'Remove fabric'} onClick={() => setFabrics(old => old.filter((_, j) => j !== i))} className="p-2 text-red-700 disabled:opacity-30"><Trash2 size={16} /></button></div>)}<div className="flex flex-wrap gap-3"><button type="button" onClick={() => setFabrics(old => [...old, { rowKey: `new-${Date.now()}-${old.length}`, name: '', active: true, sortOrder: old.length, usageCount: 0 }])} className="border border-[#1C1917]/20 px-4 py-2 flex items-center gap-2"><Plus size={16} /> Add fabric</button><button type="button" disabled={saving} onClick={saveFabrics} className="bg-[#78281F] text-white px-4 py-2 flex items-center gap-2 disabled:opacity-50">{saving ? <RefreshCw size={16} /> : <Save size={16} />} Save fabrics</button></div></div>}
    {message && <p className="text-sm text-emerald-700">{message}</p>}{error && <p className="text-sm text-red-700">{error}</p>}
  </div>;
};
