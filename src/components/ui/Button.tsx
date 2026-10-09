import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'link' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  className = '',
  children,
  leftIcon,
  rightIcon,
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B88E3E] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none tracking-normal whitespace-nowrap active:scale-[0.98]';

  const sizeStyles = {
    sm: 'text-xs px-3.5 py-2 rounded-sm gap-1.5 min-h-[36px]',
    md: 'text-sm px-5 py-2.5 rounded-sm gap-2 min-h-[44px]',
    lg: 'text-base px-7 py-3.5 rounded-sm gap-2.5 min-h-[50px]',
  }[size];

  const variantStyles = {
    primary:
      'bg-[#1C1917] text-[#FAF8F5] hover:bg-[#2E2926] active:bg-[#110F0E] shadow-sm',
    secondary:
      'bg-transparent text-[#1C1917] border border-[#1C1917]/25 hover:border-[#1C1917] hover:bg-[#FAF8F5]',
    outline:
      'bg-transparent text-[#1C1917] border border-[#1C1917]/25 hover:border-[#1C1917] hover:bg-[#FAF8F5]',
    accent:
      'bg-[#B88E3E] text-white hover:bg-[#9E782E] active:bg-[#866424] shadow-sm',
    ghost:
      'bg-transparent text-[#1C1917] hover:bg-[#F4EFE6]/70',
    link:
      'bg-transparent text-[#1C1917] underline-offset-4 hover:underline p-0 min-h-0 h-auto font-normal',
  }[variant];

  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${widthStyle} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span>{children}</span>
        </span>
      ) : (
        <>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};
