import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary:   'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/20',
  secondary: 'bg-[#1a1a24] hover:bg-[#22222e] text-[#e8e8ed] border border-[#2a2a3a]',
  ghost:     'hover:bg-[#1a1a24] text-[#a0a0b0] hover:text-[#e8e8ed]',
  danger:    'bg-red-600/80 hover:bg-red-600 text-white',
  outline:   'border border-[#2a2a3a] hover:border-blue-500/50 hover:bg-blue-500/5 text-[#e8e8ed]',
};

const sizes: Record<Size, string> = {
  sm: 'px-3.5 py-2 text-sm gap-1.5',
  md: 'px-4.5 py-2.5 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
};

export function Button({
  children, variant = 'secondary', size = 'md', loading, disabled, className, onClick, type = 'button',
}: {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  title?: string;
  type?: 'button' | 'submit' | 'reset';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-semibold transition-all duration-150 cursor-pointer',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variants[variant], sizes[size], className
      )}
    >
      {loading && <Loader2 className="animate-spin" size={14} />}
      {children}
    </button>
  );
}
