import { useEffect, useState, useId } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type ManagedSareeType = { name: string; active: boolean; sortOrder: number; imageUrl?: string };

const cache = new Map<string, ManagedSareeType[]>();
const EVENT_NAME = 'vk_saree_types_updated';

function normalizeTypes(value: any): ManagedSareeType[] {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { value = null; }
  }
  if (!Array.isArray(value?.types)) return [];
  return value.types
    .filter((item: any) => item && typeof item.name === 'string' && item.name.trim() && item.active !== false)
    .map((item: any, index: number) => ({
      name: item.name.trim(),
      active: true,
      sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
      imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl.trim() : '',
    }))
    .sort((a: ManagedSareeType, b: ManagedSareeType) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function useSareeTypes() {
  const channelId = useId().replace(/[^a-zA-Z0-9-]/g, '');
  const [types, setTypes] = useState<ManagedSareeType[]>(cache.get('active') || []);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      if (!isSupabaseConfigured()) return;
      const { data, error } = await (supabase as any).from('site_settings').select('value').eq('key', 'saree_types').maybeSingle();
      if (!alive || error) return;
      const next = normalizeTypes(data?.value);
      cache.set('active', next);
      setTypes(next);
    };
    void refresh();
    const channel = (supabase as any).channel(`shared-saree-type-settings-sync-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings', filter: 'key=eq.saree_types' }, refresh)
      .subscribe();
    window.addEventListener(EVENT_NAME, refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      alive = false;
      window.removeEventListener(EVENT_NAME, refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
      void (supabase as any).removeChannel(channel);
    };
  }, []);

  return types;
}
