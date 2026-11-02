export type PhaseStatusType = "NotStarted" | "InProgress" | "Completed" | "Locked";
export type PhaseDisplayStatus = PhaseStatusType | "Reopened" | "Cancelled";

export interface PhaseStatItem {
  label: string;
  value: number | string;
  variant?: "default" | "success" | "warning" | "danger";
}

export interface WorkflowPhase {
  id: number;
  name: string;
  key: string;
  status: PhaseStatusType;
  displayStatus?: PhaseDisplayStatus;
  stats: PhaseStatItem[];
  subprocessId?: string;
  /** Hint text shown for locked phases (e.g. "Complete Identification first") */
  lockReason?: string;
}

export interface ProcessPaperStats {
  total: number;
  notScreened: number;
  screening: number;
  included: number;
  excluded: number;
}

export interface PhaseActionProps {
  onStart?: (phaseKey: string) => void;
  onComplete?: (phaseKey: string) => void;
  onOpen?: (phaseKey: string) => void;
  onReopen?: (phaseKey: string) => void;
  startLoadingMap?: Record<string, boolean>;
  completeLoadingMap?: Record<string, boolean>;
  reopenLoadingMap?: Record<string, boolean>;
  disabled?: boolean;
}
