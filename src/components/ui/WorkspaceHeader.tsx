import type { ReactNode } from "react";

/** Compact section header using the admin workspace typography and icon treatment. */
export default function WorkspaceHeader({ title, description, icon, actions }: { title: string; description?: string; icon?: ReactNode; actions?: ReactNode }) {
  return <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-white px-5 py-4">
    <div className="flex min-w-0 items-center gap-3">
      {icon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">{icon}</span>}
      <div className="min-w-0"><h2 className="text-[18px] font-semibold tracking-[-0.02em] text-text-primary">{title}</h2>{description && <p className="mt-1 max-w-3xl text-[13px] leading-5 text-text-secondary">{description}</p>}</div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </header>;
}
