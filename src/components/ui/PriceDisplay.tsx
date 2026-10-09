import React from 'react';

interface PriceDisplayProps {
  price: number;
  mrp?: number;
  size?: 'sm' | 'md' | 'lg';
  showSavings?: boolean;
  className?: string;
}

export const formatPrice = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  price,
  mrp,
  size = 'md',
  showSavings = false,
  className = '',
}) => {
  const isDiscounted = mrp && mrp > price;
  const savings = isDiscounted ? mrp - price : 0;
  const discountPercent = isDiscounted ? Math.round(((mrp - price) / mrp) * 100) : 0;

  const sizeClasses = {
    sm: {
      price: 'text-sm font-semibold',
      mrp: 'text-xs',
      savings: 'text-[11px]',
    },
    md: {
      price: 'text-base font-semibold',
      mrp: 'text-xs',
      savings: 'text-xs',
    },
    lg: {
      price: 'text-2xl font-serif font-bold text-[#1C1917]',
      mrp: 'text-sm',
      savings: 'text-xs',
    },
  }[size];

  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 tabular-nums ${className}`}>
      <span className={`text-[#1C1917] tracking-tight ${sizeClasses.price}`}>
        {formatPrice(price)}
      </span>

      {isDiscounted && (
        <>
          <span className={`text-[#78716C] line-through font-normal ${sizeClasses.mrp}`}>
            {formatPrice(mrp)}
          </span>
          {showSavings && (
            <span className={`text-[#78281F] font-medium ${sizeClasses.savings}`}>
              Save {discountPercent}% ({formatPrice(savings)})
            </span>
          )}
        </>
      )}
    </div>
  );
};
