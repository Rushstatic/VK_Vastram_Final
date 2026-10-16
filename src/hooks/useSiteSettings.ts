import { useState, useEffect, useCallback } from 'react';
import { siteSettingsService, SiteSettingsData } from '../services/siteSettingsService';

// Warm in-memory cache plus a small public-settings cache prevents branding flashes
// on reloads. Only public storefront settings are stored here (never credentials).
const SETTINGS_CACHE_KEY = 'vk_public_site_settings_v1';

function readCachedSettings(): SiteSettingsData | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(SETTINGS_CACHE_KEY);
    return raw ? (JSON.parse(raw) as SiteSettingsData) : null;
  } catch {
    return null;
  }
}

function persistCachedSettings(value: SiteSettingsData) {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(value));
    }
  } catch {
    // Storage may be unavailable; the in-memory cache still works.
  }
}

let cachedSettings: SiteSettingsData | null = readCachedSettings();

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettingsData | null>(cachedSettings);
  const [loading, setLoading] = useState<boolean>(!cachedSettings);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await siteSettingsService.getSettings();
      cachedSettings = data;
      persistCachedSettings(data);
      setSettings(data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading site settings:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const faviconUrl = settings?.logoUrl || '/vk-vastram-logo.png?v=2';
    const iconLinks = document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]');
    iconLinks.forEach((link) => { link.removeAttribute('type'); link.href = faviconUrl; });
  }, [settings?.logoUrl]);

  useEffect(() => {
    // 1. Initial fetch
    fetchSettings();

    // 2. Synchronize with real-time updates broadcast by CMS saves
    const handleSettingsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<SiteSettingsData>;
      if (customEvent.detail) {
        cachedSettings = customEvent.detail;
        persistCachedSettings(customEvent.detail);
        setSettings(customEvent.detail);
      } else {
        fetchSettings();
      }
    };

    window.addEventListener('vk_settings_updated', handleSettingsUpdated);

    return () => {
      window.removeEventListener('vk_settings_updated', handleSettingsUpdated);
    };
  }, [fetchSettings]);

  return { settings, loading, refreshSettings: fetchSettings };
}
