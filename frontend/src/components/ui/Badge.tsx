import { cn } from '@/lib/utils';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

const variants: Record<Variant, string> = {
  default: 'bg-[#1e1e2e] text-[#e8e8ed] border border-[#2a2a3a]',
  success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  danger:  'bg-red-500/10 text-red-400 border border-red-500/20',
  info:    'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  muted:   'bg-[#16161f] text-[#6b6b80] border border-[#1e1e2e]',
};

export function Badge({ children, variant = 'default', className }: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium',
      variants[variant], className
    )}>
      {children}
    </span>
  );
}
