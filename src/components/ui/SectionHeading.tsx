import React from 'react';

interface SectionHeadingProps {
  kicker?: string;
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  kicker,
  title,
  subtitle,
  align = 'left',
  action,
  className = '',
}) => {
  const isCenter = align === 'center';

  return (
    <div
      className={`flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 sm:mb-12 ${
        isCenter ? 'text-center md:items-center' : ''
      } ${className}`}
    >
      <div className={isCenter ? 'max-w-2xl mx-auto' : 'max-w-2xl'}>
        {kicker && (
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#967029] font-semibold mb-2">
            {kicker}
          </p>
        )}
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif text-[#1C1917] tracking-tight font-normal leading-tight text-balance">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2.5 text-sm sm:text-base text-[#57534E] font-normal leading-relaxed text-balance">
            {subtitle}
          </p>
        )}
      </div>

      {action && <div className="shrink-0 pt-2 md:pt-0">{action}</div>}
    </div>
  );
};
