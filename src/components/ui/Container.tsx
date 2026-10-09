import React from 'react';

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  size?: 'default' | 'narrow' | 'wide';
  className?: string;
}

export const Container: React.FC<ContainerProps> = ({
  children,
  size = 'default',
  className = '',
  ...props
}) => {
  const maxWidthClass =
    size === 'narrow'
      ? 'max-w-4xl'
      : size === 'wide'
      ? 'max-w-[1400px]'
      : 'max-w-7xl';

  return (
    <div
      className={`mx-auto w-full px-4 sm:px-6 lg:px-8 ${maxWidthClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
