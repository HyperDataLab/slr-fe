// PRISMA Report Workspace Header — Title and export actions

interface PrismaReportHeaderProps {
  children?: React.ReactNode;
}

export default function PrismaReportHeader({
  children,
}: PrismaReportHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface-white print:static print:border-0 print:shadow-none">
      <div className="w-full px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0">
            <h1 className="review-process-header-title truncate text-xl font-semibold text-text-primary">
              PRISMA Report
            </h1>
            <p className="text-xs text-text-secondary">PRISMA 2020 Flow Diagram</p>
          </div>

          <div className="flex items-center gap-3 print:hidden">{children}</div>
        </div>
      </div>
    </header>
  );
}
