import Select from "../../../../../components/ui/Select";
import { useCallback, useMemo, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent } from "react";
import { History, Loader2, Pencil } from "lucide-react";
import type {
  ExtractionGridCellDto,
  ExtractionGridColumnMetaDto,
} from "../../../../../types/dataExtraction";
import CellAuditHistoryModal from "./CellAuditHistoryModal";
import MultiSelectDropdown from "./MultiSelectDropdown";

interface EditableGridCellProps {
  projectId?: string;
  cell: ExtractionGridCellDto;
  columnMeta: ExtractionGridColumnMetaDto;
  rowHeight: number;
  isSaving: boolean;
  onSave: (
    nextValue: string,
    isNotReported: boolean,
    cell: ExtractionGridCellDto,
  ) => Promise<void>;
}

function formatCellValue(value: string | null): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

export default function EditableGridCell({
  projectId,
  cell,
  columnMeta,
  rowHeight,
  isSaving,
  onSave,
}: EditableGridCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(formatCellValue(cell.value));
  const [isNotReported, setIsNotReported] = useState(
    Boolean(cell.isNotReported),
  );
  const editorContainerRef = useRef<HTMLDivElement | null>(null);

  const isEditable = useMemo(
    () => Boolean(cell.paperId && cell.fieldId),
    [cell.fieldId, cell.paperId],
  );
  const normalizedFieldType = useMemo(
    () => (columnMeta.fieldType || "Text").trim().toLowerCase(),
    [columnMeta.fieldType],
  );

  const beginEdit = useCallback(() => {
    if (!isEditable || isSaving) {
      return;
    }

    setDraftValue(formatCellValue(cell.value));
    setIsNotReported(Boolean(cell.isNotReported));
    setIsEditing(true);
  }, [cell.isNotReported, cell.value, isEditable, isSaving]);

  const commitChanges = useCallback(async () => {
    if (!isEditing || !isEditable || isSaving) {
      setIsEditing(false);
      return;
    }

    const currentValue = formatCellValue(cell.value);
    const currentIsNotReported = Boolean(cell.isNotReported);

    if (draftValue === currentValue && isNotReported === currentIsNotReported) {
      setIsEditing(false);
      return;
    }

    try {
      await onSave(draftValue, isNotReported, cell);
      setIsEditing(false);
    } catch {
      // Keep editor open so the user can retry or cancel after a failed save.
    }
  }, [
    cell,
    draftValue,
    isEditable,
    isEditing,
    isNotReported,
    isSaving,
    onSave,
  ]);

  const commitWithOverride = useCallback(
    async (nextDraftValue: string, nextIsNotReported: boolean) => {
      if (!isEditable || isSaving) {
        return;
      }

      const currentValue = formatCellValue(cell.value);
      const currentIsNotReported = Boolean(cell.isNotReported);

      if (
        nextDraftValue === currentValue &&
        nextIsNotReported === currentIsNotReported
      ) {
        setIsEditing(false);
        return;
      }

      try {
        await onSave(nextDraftValue, nextIsNotReported, cell);
        setIsEditing(false);
      } catch {
        // Keep editor open so the user can retry or cancel after a failed save.
      }
    },
    [cell, isEditable, isSaving, onSave],
  );

  const cancelChanges = useCallback(() => {
    setDraftValue(formatCellValue(cell.value));
    setIsNotReported(Boolean(cell.isNotReported));
    setIsEditing(false);
  }, [cell.isNotReported, cell.value]);

  const handleKeyDown = useCallback(
    async (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelChanges();
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        await commitChanges();
      }
    },
    [cancelChanges, commitChanges],
  );

  const displayedValue = formatCellValue(cell.value);
  const canViewHistory = Boolean(
    projectId && cell.paperId && cell.fieldId,
  );

  const handleEditorBlur = useCallback(
    (
      event: FocusEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      const nextFocused = event.relatedTarget;

      if (
        nextFocused instanceof Node &&
        editorContainerRef.current?.contains(nextFocused)
      ) {
        return;
      }

      void commitChanges();
    },
    [commitChanges],
  );

  const normalizeBooleanValue = (value: string): string => {
    const normalizedValue = value.trim().toLowerCase();
    if (normalizedValue === "yes" || normalizedValue === "true") {
      return "true";
    }

    if (normalizedValue === "no" || normalizedValue === "false") {
      return "false";
    }

    return "";
  };

  const renderEditor = () => {
    const textEditorRows = rowHeight >= 96 ? 3 : rowHeight >= 72 ? 2 : 1;

    switch (normalizedFieldType) {
      case "integer":
      case "decimal":
        return (
          <input
            autoFocus
            type="number"
            disabled={isNotReported}
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            onBlur={handleEditorBlur}
            onKeyDown={(event) => {
              void handleKeyDown(
                event as unknown as KeyboardEvent<HTMLTextAreaElement>,
              );
            }}
            className="h-8 w-full rounded-xl border border-primary bg-surface-white px-2 py-1 text-xs text-text-primary outline-none ring-primary/30 transition-[border-color,box-shadow] focus:ring-2 motion-reduce:transition-none disabled:cursor-not-allowed disabled:border-border disabled:bg-bg-secondary disabled:text-text-secondary"
          />
        );

      case "boolean":
        return (
          <Select
            autoFocus
            disabled={isNotReported}
            value={normalizeBooleanValue(draftValue)}
            onChange={(event) => setDraftValue(event.target.value)}
            onBlur={handleEditorBlur}
            className="h-8 w-full rounded-xl border border-primary bg-surface-white px-2 py-1 text-xs text-text-primary outline-none ring-primary/30 transition-[border-color,box-shadow] focus:ring-2 motion-reduce:transition-none disabled:cursor-not-allowed disabled:border-border disabled:bg-bg-secondary disabled:text-text-secondary"
          >
            <option value="">-</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </Select>
        );

      case "singleselect":
        return (
          <Select
            autoFocus
            disabled={isNotReported}
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            onBlur={handleEditorBlur}
            className="h-8 w-full rounded-xl border border-primary bg-surface-white px-2 py-1 text-xs text-text-primary outline-none ring-primary/30 transition-[border-color,box-shadow] focus:ring-2 motion-reduce:transition-none disabled:cursor-not-allowed disabled:border-border disabled:bg-bg-secondary disabled:text-text-secondary"
          >
            <option value="">-</option>
            {columnMeta.options.map((option) => (
              <option
                key={option.optionId || option.value}
                value={option.value}
              >
                {option.value}
              </option>
            ))}
          </Select>
        );

      case "multiselect":
        return (
          <MultiSelectDropdown
            options={columnMeta.options}
            currentValue={draftValue}
            disabled={isNotReported}
            onConfirm={(selectedOptions) => {
              const joinedValue = selectedOptions.join(", ");
              void commitWithOverride(joinedValue, isNotReported);
            }}
            onCancel={cancelChanges}
          />
        );

      case "text":
      default:
        return (
          <textarea
            autoFocus
            disabled={isNotReported}
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            onBlur={handleEditorBlur}
            onKeyDown={(event) => {
              void handleKeyDown(event);
            }}
            rows={textEditorRows}
            className="w-full resize-none rounded-xl border border-primary bg-surface-white px-2 py-1 text-xs text-text-primary outline-none ring-primary/30 transition-[border-color,box-shadow] focus:ring-2 motion-reduce:transition-none disabled:cursor-not-allowed disabled:border-border disabled:bg-bg-secondary disabled:text-text-secondary"
          />
        );
    }
  };

  return (
    <div
      className="group relative h-full min-h-9 px-1 py-1 text-sm text-text-primary"
      title={displayedValue || "-"}
      onDoubleClick={beginEdit}
    >
      {isEditing ? (
        <div
          ref={editorContainerRef}
          className="flex items-center gap-1 rounded-xl border border-border bg-bg-secondary p-1"
        >
          {normalizedFieldType !== "multiselect" && (
            <label className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-text-secondary">
              <input
                type="checkbox"
                checked={isNotReported}
                onMouseDown={(event) => {
                  event.stopPropagation();
                }}
                onChange={(event) => {
                  const nextIsNotReported = event.target.checked;
                  const nextDraftValue = nextIsNotReported ? "" : draftValue;

                  setIsNotReported(nextIsNotReported);
                  if (nextIsNotReported) {
                    setDraftValue("");
                  }

                  void commitWithOverride(nextDraftValue, nextIsNotReported);
                }}
                className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary/40"
              />
              NR
            </label>
          )}

          <div className="min-w-0 flex-1">{renderEditor()}</div>

          {normalizedFieldType !== "multiselect" && (
            <button
              type="button"
              onClick={cancelChanges}
              className="min-h-9 shrink-0 rounded px-1.5 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none"
            >
              Esc
            </button>
          )}
        </div>
      ) : (
        <div className="flex min-h-6 items-start justify-between gap-2">
          {cell.isNotReported ? (
            <span className="inline-flex rounded-full bg-bg-secondary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-text-primary">
              NR
            </span>
          ) : (
            <span className="whitespace-pre-wrap break-words leading-5">
              {displayedValue || "-"}
            </span>
          )}

          <span className="absolute right-0 top-0 z-10 flex h-full items-center gap-0.5 bg-transparent pl-1 pr-1">
            {isSaving ? (
              <Loader2 aria-hidden="true" className="h-3.5 w-3.5 motion-safe:animate-spin motion-reduce:animate-none text-accent" />
            ) : null}

            {canViewHistory ? (
              <button
                type="button"
                onClick={() => setIsHistoryOpen(true)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-white text-text-secondary opacity-0 transition-[opacity,color,background-color,border-color] duration-150 group-hover:opacity-100 group-focus-within:opacity-100 hover:border-primary/30 hover:bg-primary-light hover:text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none"
                aria-label={`View history for ${columnMeta.headerName}`}
                title="View cell history"
              >
                <History className="h-3.5 w-3.5" />
              </button>
            ) : null}

            {isEditable ? (
              <button
                type="button"
                onClick={beginEdit}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-white text-text-secondary opacity-0 transition-[opacity,color,background-color,border-color] duration-150 group-hover:opacity-100 group-focus-within:opacity-100 hover:border-primary/30 hover:bg-primary-light hover:text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none"
                aria-label={`Edit ${columnMeta.headerName}`}
                title="Edit cell"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </span>
        </div>
      )}

      {isHistoryOpen ? (
        <CellAuditHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          projectId={projectId}
          paperId={cell.paperId}
          fieldId={cell.fieldId}
          fieldLabel={columnMeta.headerName}
        />
      ) : null}
    </div>
  );
}
