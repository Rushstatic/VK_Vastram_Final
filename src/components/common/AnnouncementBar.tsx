import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useSiteSettings } from '../../hooks/useSiteSettings';

export const AnnouncementBar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);
  const { settings, loading } = useSiteSettings();
  const announcementText = settings?.announcementBarText || '';

  if (!isOpen) return null;

  return (
    <div className="relative bg-[#1C1917] text-[#FAF8F5] py-2 px-4 border-b border-[#2E2926] select-none">
      <div className="max-w-7xl mx-auto flex items-center justify-center text-center">
        <p
          className="min-h-[14px] font-medium tracking-[0.16em] uppercase text-[10px] sm:text-[11px] text-[#F4EFE6]/90 flex items-center gap-2"
          aria-busy={loading}
        >
          <span>{announcementText}</span>
        </p>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Dismiss announcement"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#FAF8F5]/50 hover:text-[#FAF8F5] transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
