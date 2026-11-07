// PRISMA Summary Header — Top summary cards showing key metrics

import {
  FiCheckCircle,
  FiCopy,
  FiDatabase,
  FiFilter,
} from "react-icons/fi";
import StatCard from "../../../../components/ui/StatCard";
import type { PrismaSummaryStats } from "../../../../types/prismaReport";
import { SUMMARY_CARDS } from "../constants";

interface PrismaSummaryHeaderProps {
  stats: PrismaSummaryStats;
  isLoading: boolean;
  generatedAt?: string | null;
}

const CARD_ICONS: Record<string, React.ReactNode> = {
  totalIdentified: <FiDatabase className="h-4 w-4" aria-hidden="true" />,
  duplicatesRemoved: <FiCopy className="h-4 w-4" aria-hidden="true" />,
  recordsScreened: <FiFilter className="h-4 w-4" aria-hidden="true" />,
  studiesIncluded: <FiCheckCircle className="h-4 w-4" aria-hidden="true" />,
};

function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      className="min-h-[104px] animate-pulse rounded-xl border border-border bg-surface-white p-3.5 motion-reduce:animate-none"
    >
      <div className="h-3 w-24 rounded bg-bg-secondary" />
      <div className="mt-3 h-7 w-12 rounded bg-bg-secondary" />
      <div className="mt-2 h-3 w-32 max-w-full rounded bg-bg-secondary" />
    </div>
  );
}

export default function PrismaSummaryHeader({
  stats,
  isLoading,
  generatedAt,
}: PrismaSummaryHeaderProps) {
  return (
    <section aria-label="Report overview">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-text-primary">Report Overview</h2>
        {generatedAt && (
          <p className="text-xs text-text-secondary">
            Snapshot ·{" "}
            {new Date(generatedAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)
          : SUMMARY_CARDS.map((card) => (
              <StatCard
                key={card.key}
                compact
                label={card.label}
                detail={card.description}
                value={stats[card.key].toLocaleString()}
                icon={CARD_ICONS[card.key]}
              />
            ))}
      </div>
    </section>
  );
}
