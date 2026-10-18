import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface ManagedSareeType {
  name: string;
  active: boolean;
  sortOrder: number;
  imageUrl?: string;
}

export interface ManagedFabricType {
  name: string;
  active: boolean;
  sortOrder: number;
}

const DEFAULT_SAREE_TYPES: ManagedSareeType[] = [
  { name: 'Chanderi', active: true, sortOrder: 0 },
  { name: 'Malmal Cotton', active: true, sortOrder: 1 },
  { name: 'Tissue Silk', active: true, sortOrder: 2 },
  { name: 'Linen Cotton', active: true, sortOrder: 3 },
  { name: 'Banarasi', active: true, sortOrder: 4 },
  { name: 'Kanjivaram', active: true, sortOrder: 5 },
  { name: 'Paithani', active: true, sortOrder: 6 },
];

let sareeTypesCache: ManagedSareeType[] | null = null;
let fabricTypesCache: ManagedFabricType[] | null = null;

function decodeSettingValue(value: any): any {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
}

function cleanManagedTypes<T extends { name: string; active: boolean; sortOrder: number }>(
  raw: any,
  withImages = false,
): T[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any, index: number) => ({
      name: typeof item?.name === 'string' ? item.name.trim() : '',
      active: item?.active !== false,
      sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : index,
      ...(withImages ? { imageUrl: typeof item?.imageUrl === 'string' ? item.imageUrl.trim() : '' } : {}),
    }))
    .filter((item: any) => item.name && item.active)
    .sort((a: any, b: any) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)) as unknown as T[];
}

function useManagedList<T extends { name: string; active: boolean; sortOrder: number }>(key: 'saree_types' | 'fabric_types', fallback: T[], cacheKind: 'saree' | 'fabric'): T[] {
  const cached = cacheKind === 'saree' ? sareeTypesCache : fabricTypesCache;
  const [items, setItems] = useState<T[]>(() => (cached as T[] | null) ?? fallback);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!isSupabaseConfigured()) {
        if (mounted) setItems((cached as T[] | null) ?? fallback);
        return;
      }
      try {
        const { data, error } = await (supabase as any)
          .from('site_settings')
          .select('value')
          .eq('key', key)
          .maybeSingle();
        if (!mounted) return;
        if (error) {
          const latestCache = (cacheKind === 'saree' ? sareeTypesCache : fabricTypesCache) as T[] | null;
          setItems(latestCache ?? fallback);
          return;
        }
        if (!data) {
          const emptySetting = cacheKind === 'fabric' ? [] : fallback;
          if (cacheKind === 'saree') sareeTypesCache = emptySetting as ManagedSareeType[];
          else fabricTypesCache = emptySetting as ManagedFabricType[];
          setItems(emptySetting as T[]);
          return;
        }
        const value = decodeSettingValue(data.value);
        const next = cleanManagedTypes<T>(value?.types, cacheKind === 'saree');
        if (cacheKind === 'saree') sareeTypesCache = next as ManagedSareeType[];
        else fabricTypesCache = next as ManagedFabricType[];
        setItems(next);
      } catch {
        if (mounted) {
          const latestCache = (cacheKind === 'saree' ? sareeTypesCache : fabricTypesCache) as T[] | null;
          setItems(latestCache ?? fallback);
        }
      }
    };

    const refresh = () => { void load(); };
    void load();
    const eventName = cacheKind === 'saree' ? 'vk_saree_types_updated' : 'vk_fabric_types_updated';
    window.addEventListener(eventName, refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    let channel: any = null;
    if (isSupabaseConfigured()) {
      channel = (supabase as any).channel(`public-${key}-sync`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings', filter: `key=eq.${key}` }, refresh)
        .subscribe();
    }
    return () => {
      mounted = false;
      window.removeEventListener(eventName, refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
      if (channel) void (supabase as any).removeChannel(channel);
    };
  }, [key, cacheKind]);

  return items;
}

export function useSareeTypes(): ManagedSareeType[] {
  return useManagedList<ManagedSareeType>('saree_types', DEFAULT_SAREE_TYPES, 'saree');
}

export function useFabricTypes(): ManagedFabricType[] {
  return useManagedList<ManagedFabricType>('fabric_types', [], 'fabric');
}
