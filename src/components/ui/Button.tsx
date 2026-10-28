import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  shortcut?: string;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  shortcut,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-mono font-medium rounded-md transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-offset-1 select-none disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1 gap-1.5',
    md: 'text-xs px-3.5 py-1.5 gap-2',
    lg: 'text-sm px-4 py-2 gap-2.5',
  };

  const variantClasses = {
    primary:
      'bg-[#3B82F6] hover:bg-[#2563EB] text-white border border-[#60A5FA]/40 focus:ring-[#3B82F6] shadow-sm',
    secondary:
      'bg-[#17233B] hover:bg-[#1E2D4A] text-[#E6EDF7] border border-[#243350] hover:border-[#33476D] focus:ring-[#3B82F6]',
    ghost:
      'bg-transparent hover:bg-[#17233B] text-[#9FB0CC] hover:text-[#E6EDF7] border border-transparent focus:ring-[#243350]',
    danger:
      'bg-[#7F1D1D]/70 hover:bg-[#991B1B] text-[#FCA5A5] border border-[#DC2626]/60 focus:ring-[#EF4444]',
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
      {shortcut && (
        <kbd className="ml-1 px-1 py-0.2 rounded text-[10px] font-mono bg-black/30 border border-white/20 text-white/70">
          {shortcut}
        </kbd>
      )}
    </button>
  );
};
