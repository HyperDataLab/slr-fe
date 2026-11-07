import type { ReactNode } from "react";

/** Shared by the admin overview and project workspaces. */
export default function StatCard({ label, detail, value, icon, onClick, compact = false }: { label: string; detail?: string; value: ReactNode; icon?: ReactNode; onClick?: () => void; compact?: boolean }) {
  const content = compact
    ? <div className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-text-secondary">{label}</p>{detail && <p className="mt-1 text-[12px] text-text-muted">{detail}</p>}<div className="mt-1 text-2xl font-semibold leading-7 tabular-nums tracking-[-0.03em] text-text-primary">{value}</div></div>{icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>}</div>
    : <><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-secondary">{label}</p>{detail && <p className="mt-1.5 text-[12px] text-text-muted">{detail}</p>}</div>{icon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>}</div><div className="mt-5 text-[31px] font-semibold leading-none tracking-[-0.04em] text-text-primary">{value}</div></>;
  const style = `rounded-xl border border-border bg-surface-white ${compact ? "p-3.5" : "p-5"} text-left`;
  return onClick ? <button type="button" onClick={onClick} className={`${style} group transition-colors hover:border-primary/50 hover:bg-primary-light/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}>{content}</button> : <div className={style}>{content}</div>;
}
