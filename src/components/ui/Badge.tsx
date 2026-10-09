import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'subtle' | 'gold' | 'dark' | 'outline';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'subtle',
  className = '',
}) => {
  const styles = {
    subtle: 'text-[#78716C] bg-[#FAF8F5]/90 border border-[#E7E0D2] px-2.5 py-0.5 text-[11px] uppercase tracking-wider font-medium',
    gold: 'text-[#967029] bg-[#FDFBF7] border border-[#E5D7B7] px-2.5 py-0.5 text-[11px] uppercase tracking-wider font-medium',
    dark: 'text-[#FAF8F5] bg-[#1C1917] px-2.5 py-0.5 text-[11px] uppercase tracking-wider font-medium',
    outline: 'text-[#1C1917] border border-[#1C1917]/30 px-2 py-0.5 text-[11px] uppercase tracking-wider font-medium',
  }[variant];

  return (
    <span className={`inline-block whitespace-nowrap rounded-none ${styles} ${className}`}>
      {children}
    </span>
  );
};
