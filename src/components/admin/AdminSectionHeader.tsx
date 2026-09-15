import type { ReactNode } from 'react';

export function SectionHeader({ title, sub, count, children }: { title: string; sub?: string; count?: number; children?: ReactNode }) {
  return (
    <div className="admin-section-header">
      <div className="flex items-baseline gap-2 min-w-0">
        <h2 className="admin-section-title truncate">{title}</h2>
        {typeof count === 'number' && (
          <span className="text-[11px] tabular-nums text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{count}</span>
        )}
        {sub && <span className="admin-section-sub truncate">· {sub}</span>}
      </div>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}