import { useEffect, useState, useId } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type ManagedFabric = { name: string; active: boolean; sortOrder: number };
const DEFAULT_FABRICS: ManagedFabric[] = [
  { name: 'Malmal Cotton', active: true, sortOrder: 0 },
  { name: 'Tissue Silk', active: true, sortOrder: 1 },
  { name: 'Linen Cotton', active: true, sortOrder: 2 },
  { name: 'Pure Silk', active: true, sortOrder: 3 },
  { name: 'Katan Silk', active: true, sortOrder: 4 },
  { name: 'Silk Cotton Blend', active: true, sortOrder: 5 },
  { name: 'Cotton', active: true, sortOrder: 6 },
];
const cache = new Map<string, ManagedFabric[]>();
export function useManagedFabrics() {
  const channelId = useId().replace(/[^a-zA-Z0-9-]/g, '');
  const [fabrics, setFabrics] = useState<ManagedFabric[]>(cache.get('active') || DEFAULT_FABRICS);
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      if (!isSupabaseConfigured()) return;
      const { data, error } = await (supabase as any).from('site_settings').select('value').eq('key', 'fabric_types').maybeSingle();
      if (!alive || error || !data) return;
      let value = data.value;
      if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = null; } }
      if (!Array.isArray(value?.types)) return;
      const next = value.types.filter((x: any) => x && x.active !== false && typeof x.name === 'string' && x.name.trim())
        .map((x: any, i: number) => ({ name: x.name.trim(), active: true, sortOrder: Number.isFinite(Number(x.sortOrder)) ? Number(x.sortOrder) : i }))
        .sort((a: ManagedFabric, b: ManagedFabric) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      cache.set('active', next); setFabrics(next);
    };
    void refresh();
    const channel = (supabase as any).channel(`shared-fabric-type-settings-sync-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings', filter: 'key=eq.fabric_types' }, refresh).subscribe();
    window.addEventListener('vk_fabric_types_updated', refresh);
    window.addEventListener('focus', refresh);
    return () => { alive = false; window.removeEventListener('vk_fabric_types_updated', refresh); window.removeEventListener('focus', refresh); void (supabase as any).removeChannel(channel); };
  }, []);
  return fabrics;
}
