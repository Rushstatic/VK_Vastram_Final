import { useState, useEffect, useCallback } from 'react';
import { siteSettingsService, SiteSettingsData } from '../services/siteSettingsService';

// Module-level cache to provide instant values to newly mounting components
let cachedSettings: SiteSettingsData | null = null;

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettingsData | null>(cachedSettings);
  const [loading, setLoading] = useState<boolean>(!cachedSettings);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await siteSettingsService.getSettings();
      cachedSettings = data;
      setSettings(data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading site settings:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 1. Initial fetch
    fetchSettings();

    // 2. Synchronize with real-time updates broadcast by CMS saves
    const handleSettingsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<SiteSettingsData>;
      if (customEvent.detail) {
        cachedSettings = customEvent.detail;
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
