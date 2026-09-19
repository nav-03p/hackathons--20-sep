import { cn } from '@/lib/utils';

export function Card({ children, className, onClick }: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-[#111118] border border-[#1e1e2e] rounded-lg',
        onClick && 'cursor-pointer hover:border-[#2a2a3a] transition-colors',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-5 py-4 border-b border-[#1e1e2e]', className)}>{children}</div>;
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}
