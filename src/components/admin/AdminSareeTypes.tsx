import React, { useEffect, useState } from 'react';
import { Plus, Save, Trash2, RefreshCw } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { MediaUploader } from './MediaUploader';

type SareeType = { rowKey: string; name: string; active: boolean; imageUrl?: string };
const DEFAULT_TYPES: SareeType[] = [
  { rowKey: 'default-chanderi', name: 'Chanderi', active: true, imageUrl: '' }, { rowKey: 'default-malmal', name: 'Malmal Cotton', active: true, imageUrl: '' },
  { rowKey: 'default-tissue', name: 'Tissue Silk', active: true, imageUrl: '' }, { rowKey: 'default-linen', name: 'Linen Cotton', active: true, imageUrl: '' },
  { rowKey: 'default-banarasi', name: 'Banarasi', active: true, imageUrl: '' }, { rowKey: 'default-kanjivaram', name: 'Kanjivaram', active: true, imageUrl: '' },
  { rowKey: 'default-paithani', name: 'Paithani', active: true, imageUrl: '' },
];
export const AdminSareeTypes: React.FC = () => {
  const [types, setTypes] = useState<SareeType[]>(DEFAULT_TYPES);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(''); const [error, setError] = useState('');
  useEffect(() => { (async () => {
    if (!isSupabaseConfigured()) { setLoading(false); return; }
    const { data, error } = await (supabase as any).from('site_settings').select('value').eq('key', 'saree_types').maybeSingle();
    if (!error && Array.isArray(data?.value?.types)) setTypes(data.value.types.filter((t: any) => t && typeof t.name === 'string').map((t: any, i: number) => ({rowKey:`saved-${i}-${String(t.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name:t.name, active:t.active !== false, imageUrl: typeof t.imageUrl === 'string' ? t.imageUrl : ''})));
    setLoading(false);
  })(); }, []);
  const save = async () => {
    setSaving(true); setMessage(''); setError('');
    const cleaned = types
  .map(t => ({
    ...t,
    name: t.name.trim(),
  }))
  .filter(t => t.name);
    if (new Set(cleaned.map(t => t.name.toLowerCase())).size !== cleaned.length) { setError('Saree type names must be unique.'); setSaving(false); return; }
    if (!isSupabaseConfigured()) { setError('Supabase is not configured; changes cannot sync across sessions.'); setSaving(false); return; }
    const { error } = await (supabase as any).from('site_settings').upsert({key:'saree_types', value:{types:cleaned}, updated_at:new Date().toISOString()});
    if (error) setError(`Save failed: ${error.message}`); else { setTypes(cleaned); window.dispatchEvent(new CustomEvent('vk_saree_types_updated')); setMessage('Saree types and circle images saved to the storefront.'); }
    setSaving(false);
  };
  return <div className="max-w-3xl mx-auto space-y-5 text-[#1C1917]">
    <header><h1 className="font-serif text-3xl">Saree Types</h1><p className="text-sm text-[#78716C] mt-1">Manage the type options available when creating or editing sarees. Deactivate rather than delete types already used by products.</p></header>
    {loading ? <p className="text-sm">Loading saved types…</p> : <div className="space-y-3">{types.map((t,i)=><div key={t.rowKey} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-3 items-center border border-[#1C1917]/15 p-3 bg-[#FAF8F5]"><input value={t.name} onChange={e=>setTypes(old=>old.map((x,j)=>j===i?{...x,name:e.target.value}:x))} className="min-w-0 border p-2 bg-white" aria-label={`Saree type ${i+1}`}/><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={t.active} onChange={e=>setTypes(old=>old.map((x,j)=>j===i?{...x,active:e.target.checked}:x))}/> Active</label><button type="button" title="Remove unsaved row" onClick={()=>setTypes(old=>old.filter((_,j)=>j!==i))} className="p-2 text-red-700"><Trash2 size={16}/></button><div className="sm:col-span-3 border-t border-[#1C1917]/10 pt-3"><MediaUploader label={`${t.name || 'Saree type'} circle image`} value={t.imageUrl || ''} onChange={url=>setTypes(old=>old.map((x,j)=>j===i?{...x,imageUrl:url}:x))} folder="categories" recommendedSize="Recommended 800 × 800 px · Square crop for Saree Traditions" /></div></div>)}
    <div className="flex flex-wrap gap-3"><button type="button" onClick={()=>setTypes(old=>[...old,{rowKey:`new-${Date.now()}-${old.length}`,name:'',active:true,imageUrl:''}])} className="border border-[#1C1917]/20 px-4 py-2 flex items-center gap-2"><Plus size={16}/> Add type</button><button type="button" disabled={saving} onClick={save} className="bg-[#78281F] text-white px-4 py-2 flex items-center gap-2 disabled:opacity-50">{saving?<RefreshCw size={16}/>:<Save size={16}/>} Save types</button></div></div>}
    {message&&<p className="text-sm text-emerald-700">{message}</p>}{error&&<p className="text-sm text-red-700">{error}</p>}
  </div>;
};
