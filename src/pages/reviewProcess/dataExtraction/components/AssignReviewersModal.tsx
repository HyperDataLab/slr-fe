import { useMemo, useState } from "react";
import { Users2 } from "lucide-react";
import Button from "../../../../components/ui/Button";
import Modal from "../../../../components/ui/Modal";
import Select from "../../../../components/ui/Select";
import { getInitials } from "../../../../utils/getInitials";

interface DashboardTask {
  paperId: string;
  title: string;
  reviewer1Id: string | null;
  reviewer2Id: string | null;
}

interface ReviewerOption {
  value: string;
  label: string;
}

interface AssignPayload {
  reviewer1Id: string;
  reviewer2Id: string;
}

interface AssignReviewersModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: DashboardTask | null;
  reviewerOptions: ReviewerOption[];
  onAssign: (payload: AssignPayload) => void;
}

export default function AssignReviewersModal({
  isOpen,
  onClose,
  task,
  reviewerOptions,
  onAssign,
}: AssignReviewersModalProps) {
  const [rev1, setRev1] = useState(task?.reviewer1Id ?? "");
  const [rev2, setRev2] = useState(task?.reviewer2Id ?? "");

  const selectableReviewers = useMemo(
    () => reviewerOptions.filter((option) => option.value),
    [reviewerOptions],
  );

  const reviewer1Options = useMemo(
    () => [
      { value: "", label: "Select Reviewer 1" },
      ...selectableReviewers.filter((option) => option.value !== rev2),
    ],
    [rev2, selectableReviewers],
  );

  const reviewer2Options = useMemo(
    () => [
      { value: "", label: "Select Reviewer 2" },
      ...selectableReviewers.filter((option) => option.value !== rev1),
    ],
    [rev1, selectableReviewers],
  );

  const canSave = Boolean(task && rev1 && rev2 && rev1 !== rev2);

  const handleSave = () => {
    if (!task || !canSave) {
      return;
    }

    onAssign({ reviewer1Id: rev1, reviewer2Id: rev2 });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Reviewers"
      description={
        task ? "Choose two distinct reviewers for this study." : undefined
      }
      size="lg"
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-bg-primary p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-accent">
              <Users2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary">
                Selected Study
              </p>
              <h3 className="mt-1 truncate text-lg font-bold text-text-primary">
                {task?.title ?? "No study selected"}
              </h3>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface-white p-4">
            <label className="mb-3 block text-sm font-semibold text-text-primary">
              Reviewer 1
            </label>
            <Select
              value={rev1}
              onChange={(event) => {
                const nextValue = event.target.value;
                setRev1(nextValue);
                if (nextValue === rev2) {
                  setRev2("");
                }
              }}
              options={reviewer1Options}
              searchable
              searchPlaceholder="Search reviewers..."
              className="text-sm"
            />
          </div>

          <div className="rounded-xl border border-border bg-surface-white p-4">
            <label className="mb-3 block text-sm font-semibold text-text-primary">
              Reviewer 2
            </label>
            <Select
              value={rev2}
              onChange={(event) => {
                const nextValue = event.target.value;
                setRev2(nextValue);
                if (nextValue === rev1) {
                  setRev1("");
                }
              }}
              options={reviewer2Options}
              searchable
              searchPlaceholder="Search reviewers..."
              className="text-sm"
            />
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-border bg-bg-secondary p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary">
            Assignment Preview
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {rev1 ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-bg-secondary px-3 py-2 text-sm font-semibold text-accent ring-1 ring-accent/30">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-light text-[11px] font-bold text-accent">
                  {getInitials(
                    reviewerOptions.find((option) => option.value === rev1)
                      ?.label ?? "",
                  )}
                </span>
                {reviewerOptions.find((option) => option.value === rev1)?.label}
              </span>
            ) : null}

            {rev2 ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-bg-secondary px-3 py-2 text-sm font-semibold text-text-primary ring-1 ring-border">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-secondary text-[11px] font-bold text-text-primary">
                  {getInitials(
                    reviewerOptions.find((option) => option.value === rev2)
                      ?.label ?? "",
                  )}
                </span>
                {reviewerOptions.find((option) => option.value === rev2)?.label}
              </span>
            ) : null}

            {!rev1 && !rev2 ? (
              <span className="text-sm text-text-secondary">
                Select two reviewers to continue.
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            className="sm:min-w-[130px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="sm:min-w-[180px]"
          >
            Save Assignments
          </Button>
        </div>
      </div>
    </Modal>
  );
}
