import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
} from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import type {
  ColDef,
  ICellRendererParams,
  ValueFormatterParams,
} from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import Button from "../../../../../components/ui/Button";
import { useDataExtractionWorkspace } from "../../hooks/useDataExtractionWorkspace";
import { dataExtractionConductingService } from "../../../../../services/dataExtractionConductingService";
import type {
  ExtractionEditableGridDto,
  ExtractionGridCellDto,
  ExtractionGridColumnMetaDto,
  GridFieldOptionDto,
  ExtractionFieldDto,
  ExtractionTemplateDto,
  ExtractionTemplateResponseDto,
} from "../../../../../types/dataExtraction";
import { getErrorMessage } from "../../../../../utils/errorUtils";
import { formatDate } from "../../../../../utils/dateFormat";
import { toastError, toastSuccess } from "../../../../../utils/toast";
import EditableGridCell from "./EditableGridCell";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import "./ExtractionGridWorkspace.css";

ModuleRegistry.registerModules([AllCommunityModule]);

const MIN_GRID_ROW_HEIGHT = 44;
const MAX_GRID_ROW_HEIGHT = 140;
const DEFAULT_GRID_ROW_HEIGHT = 56;

interface AgGridRowData {
  id: string;
  citation: string;
  paperTitle: string;
  citationPaper: string;
  __cellMeta: Record<string, ExtractionGridCellDto>;
  [key: string]: unknown;
}

function createEmptyGrid(): ExtractionEditableGridDto {
  return {
    columns: [],
    rows: [],
  };
}


function getColumnFieldKey(
  column: ExtractionGridColumnMetaDto,
  columnIndex: number,
): string {
  return `${column.fieldId || "field"}_${columnIndex}`;
}

function groupColumnsBySection(
  columns: ExtractionGridColumnMetaDto[],
): Map<string, Array<{ column: ExtractionGridColumnMetaDto; index: number }>> {
  const groups = new Map<
    string,
    Array<{ column: ExtractionGridColumnMetaDto; index: number }>
  >();

  columns.forEach((column, index) => {
    const sectionKey = column.sectionName || "Ungrouped";
    if (!groups.has(sectionKey)) {
      groups.set(sectionKey, []);
    }
    groups.get(sectionKey)!.push({ column, index });
  });

  return groups;
}

/**
 * Enriches grid column metadata with full field options from the template.
 * This ensures that multi-select and single-select fields show all available options,
 * not just the ones currently selected.
 */
function enrichColumnsWithTemplateOptions(
  columns: ExtractionGridColumnMetaDto[],
  selectedTemplate:
    | (ExtractionTemplateDto | ExtractionTemplateResponseDto)
    | null,
): ExtractionGridColumnMetaDto[] {
  if (!selectedTemplate) {
    return columns;
  }

  // Flatten all fields from the template to find options by fieldId
  const fieldMap = new Map<string, ExtractionFieldDto>();

  const flattenFields = (fields: ExtractionFieldDto[]) => {
    fields.forEach((field) => {
      fieldMap.set(field.fieldId ?? "", field);
      if (field.subFields && field.subFields.length > 0) {
        flattenFields(field.subFields);
      }
    });
  };

  // Get all fields from sections
  if (selectedTemplate.sections) {
    selectedTemplate.sections.forEach((section) => {
      if (section.fields) {
        flattenFields(section.fields);
      }
    });
  } else if (selectedTemplate.fields) {
    flattenFields(selectedTemplate.fields);
  }

  // Enrich columns with template field options
  return columns.map((column) => {
    const templateField = fieldMap.get(column.fieldId);

    // If we found the template field and it has options, use those instead
    if (
      templateField &&
      templateField.options &&
      templateField.options.length > 0
    ) {
      return {
        ...column,
        options: templateField.options as GridFieldOptionDto[],
      };
    }

    return column;
  });
}

export default function ExtractionGridWorkspace() {
  const navigate = useNavigate();
  const ws = useDataExtractionWorkspace();
  const projectId = ws.projectId;
  const selectedTemplate = ws.selectedTemplate;
  const [gridData, setGridData] =
    useState<ExtractionEditableGridDto>(createEmptyGrid);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [savingCells, setSavingCells] = useState<Record<string, boolean>>({});
  const [rowHeight, setRowHeight] = useState(DEFAULT_GRID_ROW_HEIGHT);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const exportMenuPanelRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<AgGridReact<AgGridRowData> | null>(null);
  const [exportMenuPosition, setExportMenuPosition] = useState({
    top: 0,
    left: 0,
    minWidth: 0,
  });

  const dashboardPath = useMemo(
    () => (projectId ? `/projects/${projectId}/extraction` : "/projects"),
    [projectId],
  );

  useEffect(() => {
    setGridData(ws.editableGrid ?? createEmptyGrid());
  }, [ws.editableGrid]);
  // Enrich grid data with template field options
  const enrichedGridData = useMemo(() => {
    const enrichedColumns = enrichColumnsWithTemplateOptions(
      gridData.columns,
      selectedTemplate,
    );
    return {
      ...gridData,
      columns: enrichedColumns,
    };
  }, [gridData, selectedTemplate]);

  const agRowData = useMemo<AgGridRowData[]>(() => {
    return enrichedGridData.rows.map((row, rowIndex) => {
      const dynamicValues: Record<string, unknown> = {};
      const cellMeta: Record<string, ExtractionGridCellDto> = {};

      enrichedGridData.columns.forEach((column, columnIndex) => {
        const fieldKey = getColumnFieldKey(column, columnIndex);
        const cell = row.cells[column.headerName] ?? {
          paperId: null,
          fieldId: column.fieldId,
          matrixColumnId: null,
          matrixRowIndex: null,
          value: "",
          isNotReported: false,
          fieldType: column.fieldType,
        };

        dynamicValues[fieldKey] = cell.isNotReported
          ? "NR"
          : (cell.value ?? "");
        cellMeta[fieldKey] = cell;
      });

      return {
        id: row.rowId || `grid-row-${rowIndex}`,
        citation: row.citation || "-",
        paperTitle: row.paperTitle || "Untitled paper",
        citationPaper: `${row.citation || "-"} | ${row.paperTitle || "Untitled paper"}`,
        __cellMeta: cellMeta,
        ...dynamicValues,
      };
    });
  }, [enrichedGridData.columns, enrichedGridData.rows]);

  const defaultColDef = useMemo<ColDef<AgGridRowData>>(
    () => ({
      resizable: true,
      sortable: true,
      filter: true,
      minWidth: 140,
      flex: 1,
    }),
    [],
  );

  const buildSavingCellKey = useCallback(
    (rowId: string, fieldKey: string): string => {
      return `${rowId}::${fieldKey}`;
    },
    [],
  );

  const handleRefreshGrid = useCallback(async () => {
    await ws.getEditableGrid();
  }, [ws]);

  const handleSaveCell = useCallback(
    async (
      rowId: string,
      fieldKey: string,
      headerName: string,
      nextValue: string,
      isNotReported: boolean,
      cell: ExtractionGridCellDto,
    ) => {
      if (!cell.paperId || !cell.fieldId) {
        return;
      }

      const savingKey = buildSavingCellKey(rowId, fieldKey);
      setSavingCells((previous) => ({
        ...previous,
        [savingKey]: true,
      }));

      const normalizedValue = nextValue.trim();

      try {
        const expectedVersion = await ws.fetchPaperVersion(cell.paperId);
        if (expectedVersion === null) {
          throw new Error("Unable to determine the current version for this study.");
        }

        await ws.updateGridCell({
          paperId: cell.paperId,
          fieldId: cell.fieldId,
          columnId: cell.matrixColumnId ?? undefined,
          row: cell.matrixRowIndex ?? undefined,
          value: isNotReported ? null : normalizedValue || null,
          expectedVersion,
        });
        setGridData((previous) => ({
          ...previous,
          rows: previous.rows.map((row) => {
            if (row.rowId !== rowId) {
              return row;
            }

            const targetCell = row.cells[headerName] ?? null;
            if (!targetCell) {
              return row;
            }

            return {
              ...row,
              cells: {
                ...row.cells,
                [headerName]: {
                  ...targetCell,
                  value: isNotReported ? null : normalizedValue || null,
                  isNotReported,
                },
              },
            };
          }),
        }));

        toastSuccess("Cell updated");
      } catch (error) {
        toastError(
          "Failed to save cell",
          getErrorMessage(error, "Unable to save this cell right now."),
        );
      } finally {
        setSavingCells((previous) => {
          const next = { ...previous };
          delete next[savingKey];
          return next;
        });
      }
    },
    [buildSavingCellKey, ws],
  );

  const columnDefs = useMemo<ColDef<AgGridRowData>[]>(() => {
    const pinnedColumn: ColDef<AgGridRowData> = {
      headerName: "Citation / Paper",
      field: "citationPaper",
      pinned: "left",
      editable: false,
      minWidth: 300,
      maxWidth: 460,
      cellClass: "font-medium",
      tooltipValueGetter: (params) =>
        `${params.data?.citation || "-"}\n${params.data?.paperTitle || "Untitled paper"}`,
      valueFormatter: (params: ValueFormatterParams<AgGridRowData>) => {
        const citation = params.data?.citation || "-";
        const title = params.data?.paperTitle || "Untitled paper";
        return `${citation} | ${title}`;
      },
    };

    // Helper function to create a column definition for a single field
    const createFieldColDef = (
      column: ExtractionGridColumnMetaDto,
      columnIndex: number,
    ): ColDef<AgGridRowData> => {
      const fieldKey = getColumnFieldKey(column, columnIndex);
      const fieldType = (column.fieldType || "Text").trim().toLowerCase();

      const baseColDef: ColDef<AgGridRowData> = {
        headerName: column.displayFieldName,
        field: fieldKey,
        editable: false,
        minWidth: 180,
        cellRenderer: (params: ICellRendererParams<AgGridRowData>) => {
          const rowId = params.data?.id;
          const cell = params.data?.__cellMeta?.[fieldKey];

          if (!rowId || !cell) {
            return null;
          }

          const isSaving = Boolean(
            savingCells[buildSavingCellKey(rowId, fieldKey)],
          );

          return (
            <EditableGridCell
              projectId={projectId}
              cell={cell}
              columnMeta={column}
              rowHeight={rowHeight}
              isSaving={isSaving}
              onSave={(nextValue, isNotReported, targetCell) =>
                handleSaveCell(
                  rowId,
                  fieldKey,
                  column.headerName,
                  nextValue,
                  isNotReported,
                  targetCell,
                )
              }
            />
          );
        },
      };

      if (fieldType === "integer" || fieldType === "decimal") {
        return baseColDef;
      }

      if (fieldType === "boolean") {
        return {
          ...baseColDef,
          valueFormatter: (params: ValueFormatterParams<AgGridRowData>) => {
            const value = String(params.value ?? "")
              .trim()
              .toLowerCase();
            if (value === "true" || value === "yes") {
              return "True";
            }
            if (value === "false" || value === "no") {
              return "False";
            }
            return "";
          },
        };
      }

      if (fieldType === "singleselect") {
        return baseColDef;
      }

      return baseColDef;
    };

    // Group columns by section
    const columnsBySection = groupColumnsBySection(enrichedGridData.columns);

    // Build grouped column definitions
    const groupedColumnDefs: ColDef<AgGridRowData>[] = Array.from(
      columnsBySection.entries(),
    ).map(([sectionName, columnsInSection]) => ({
      headerName: sectionName,
      children: columnsInSection.map(({ column, index }) =>
        createFieldColDef(column, index),
      ),
    }));

    return [pinnedColumn, ...groupedColumnDefs];
  }, [
    buildSavingCellKey,
    projectId,
    enrichedGridData.columns,
    handleSaveCell,
    rowHeight,
    savingCells,
  ]);

  const handleDownloadJson = useCallback(async () => {
    if (!projectId) {
      return;
    }

    setIsExportingExcel(true);
    setIsExportMenuOpen(false);

    try {
      const blob = await dataExtractionConductingService.exportExtractedData(
        projectId,
        "json",
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "Extraction_Data.json";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      toastError(
        "Download failed",
        getErrorMessage(error, "Unable to download the extraction data."),
      );
    } finally {
      setIsExportingExcel(false);
    }
  }, [projectId]);

  const handleDownloadCsv = useCallback(async () => {
    if (!projectId) {
      return;
    }

    setIsExportingCsv(true);
    setIsExportMenuOpen(false);

    try {
      const blob =
        await dataExtractionConductingService.exportExtractedDataCsv(
          projectId,
        );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "Extraction_Data.csv";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      toastError(
        "Download failed",
        getErrorMessage(error, "Unable to download the extraction CSV file."),
      );
    } finally {
      setIsExportingCsv(false);
    }
  }, [projectId]);


  const isExporting = isExportingExcel || isExportingCsv;

  const updateExportMenuPosition = useCallback(() => {
    if (!exportMenuRef.current) {
      return;
    }

    const rect = exportMenuRef.current.getBoundingClientRect();
    setExportMenuPosition({
      top: rect.bottom + window.scrollY + 8,
      left: rect.left + window.scrollX,
      minWidth: Math.max(rect.width, 224),
    });
  }, []);

  useLayoutEffect(() => {
    if (isExportMenuOpen) {
      updateExportMenuPosition();
    }
  }, [isExportMenuOpen, updateExportMenuPosition]);

  useEffect(() => {
    gridRef.current?.api?.resetRowHeights();
  }, [rowHeight]);

  useEffect(() => {
    if (!isExportMenuOpen) {
      return;
    }

    const handlePositionUpdate = () => {
      updateExportMenuPosition();
    };

    window.addEventListener("scroll", handlePositionUpdate, true);
    window.addEventListener("resize", handlePositionUpdate);

    return () => {
      window.removeEventListener("scroll", handlePositionUpdate, true);
      window.removeEventListener("resize", handlePositionUpdate);
    };
  }, [isExportMenuOpen, updateExportMenuPosition]);

  useEffect(() => {
    if (!isExportMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!exportMenuRef.current || !exportMenuPanelRef.current) {
        return;
      }

      if (
        event.target instanceof Node &&
        !exportMenuRef.current.contains(event.target) &&
        !exportMenuPanelRef.current.contains(event.target)
      ) {
        setIsExportMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isExportMenuOpen]);

  const hasData =
    enrichedGridData.columns.length > 0 && enrichedGridData.rows.length > 0;
  const gridContentHeight = 88 + agRowData.length * rowHeight;
  const extractionStatusLabel =
    ws.extractionProcessStatus === "InProgress"
      ? "Active"
      : ws.extractionProcessStatus === "NotStarted"
        ? "Not started"
        : ws.extractionProcessStatus;

  if (ws.isGridLoading && !ws.editableGrid) {
    return (
      <div className="min-h-screen bg-bg-secondary px-6 py-8">
        <div
          className="mx-auto flex max-w-7xl items-center justify-center rounded-xl border border-border bg-surface-white py-24 shadow-none"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <RefreshCw aria-hidden="true" className="h-5 w-5 motion-safe:animate-spin motion-reduce:animate-none text-accent" />
          <span className="ml-3 text-sm text-text-secondary">
            Loading editable grid...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="border-b border-border bg-surface-white">
        <div className="mx-auto flex max-w-[1520px] flex-col gap-4 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="min-w-0">
            <h1 className="review-process-header-title line-clamp-2 text-base font-semibold leading-5 text-text-primary sm:text-lg">
              Extraction Grid Workspace
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="text-xs text-text-secondary">Data extraction / Leader view</span>
              <span className="h-1 w-1 rounded-full bg-text-muted" aria-hidden="true" />
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  ws.extractionProcessStatus === "InProgress"
                    ? "bg-success/10 text-success"
                    : ws.extractionProcessStatus === "Completed"
                      ? "bg-primary-light text-primary"
                      : "bg-bg-secondary text-text-secondary"
                }`}
              >
                {extractionStatusLabel}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 lg:gap-5">
            <div className="text-xs text-text-secondary">
              <div className="text-[10px] font-medium text-text-muted">Studies</div>
              <div className="mt-0.5 font-medium text-text-primary">
                {ws.dashboardTotalCount} visible
              </div>
            </div>
            <div className="hidden h-8 w-px bg-border sm:block" aria-hidden="true" />
            <div className="text-xs text-text-secondary">
              <div className="text-[10px] font-medium text-text-muted">Started</div>
              <div className="mt-0.5 font-medium text-text-primary">
                {formatDate(ws.extractionProcessStartedAt)}
              </div>
            </div>
            <div className="hidden h-8 w-px bg-border sm:block" aria-hidden="true" />
            <div className="text-xs text-text-secondary">
              <div className="text-[10px] font-medium text-text-muted">Last updated</div>
              <div className="mt-0.5 font-medium text-text-primary">
                {formatDate(ws.extractionProcessLastUpdatedAt)}
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="mx-auto w-full max-w-[1520px] px-4 pt-4 sm:px-6 lg:px-8" aria-label="Breadcrumb">
        <button
          type="button"
          onClick={() => navigate(dashboardPath)}
          className="inline-flex min-h-9 items-center gap-2 text-sm text-text-secondary transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <ArrowLeft className="h-[17px] w-[17px]" aria-hidden="true" />
          Back to Dashboard
        </button>
      </nav>

      <div className="mx-auto max-w-[1520px] space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-text-secondary">
              {hasData
                ? "Review and standardize reviewer submissions before leader consensus."
                : "The grid becomes available after a paper has a template and reviewer assignment."}
            </p>
            {hasData && (
              <p className="mt-1 text-xs text-text-secondary lg:hidden">
                Swipe the grid horizontally to view all extraction fields.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">

              {hasData && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleRefreshGrid}
                    disabled={ws.isGridLoading}
                  >
                    <RefreshCw
                      aria-hidden="true"
                      className={`mr-2 h-4 w-4 ${ws.isGridLoading ? "motion-safe:animate-spin motion-reduce:animate-none" : ""}`}
                    />
                    Refresh Grid
                  </Button>

                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-white px-2.5 py-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    Row Height
                  </span>
                  <input
                    type="range"
                    min={MIN_GRID_ROW_HEIGHT}
                    max={MAX_GRID_ROW_HEIGHT}
                    value={rowHeight}
                    onChange={(event) => setRowHeight(Number(event.target.value))}
                    className="h-8 w-24 cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    aria-label="Grid row height"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRowHeight(72)}
                    className="min-h-9 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    Comfort
                  </button>
                  <button
                    type="button"
                    onClick={() => setRowHeight(DEFAULT_GRID_ROW_HEIGHT)}
                    className="min-h-9 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    Reset
                  </button>
                  <span className="ml-auto min-w-8 text-right text-xs font-semibold text-text-primary">
                    {rowHeight}px
                  </span>
                </div>
                  </div>

                  <div className="relative z-50" ref={exportMenuRef}>
                <Button
                  onClick={() => setIsExportMenuOpen((current) => !current)}
                  disabled={isExporting || !projectId}
                  aria-busy={isExporting}
                >
                  {isExporting ? (
                    <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Export Data
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>

                {isExportMenuOpen
                  ? createPortal(
                      <div
                        ref={exportMenuPanelRef}
                        className="fixed z-(--z-index-dropdown) rounded-xl border border-border bg-surface-white p-1.5 shadow-2xl"
                        style={{
                          top: `${exportMenuPosition.top}px`,
                          left: `${exportMenuPosition.left}px`,
                          minWidth: `${exportMenuPosition.minWidth}px`,
                        }}
                      >
                        <button
                          type="button"
                          onClick={handleDownloadJson}
                          disabled={isExporting}
                          className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-text-primary transition-colors hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <FileSpreadsheet className="h-4 w-4 flex-shrink-0 text-success" />
                          <span className="truncate">JSON (.json)</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadCsv}
                          disabled={isExporting}
                          className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-text-primary transition-colors hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <FileText className="h-4 w-4 flex-shrink-0 text-accent" />
                          <span className="truncate">CSV (.csv)</span>
                        </button>
                      </div>,
                      document.body,
                    )
                  : null}
                  </div>
                </>
              )}
            </div>
        </div>

        {ws.error ? (
          <div className="rounded-xl border border-border bg-surface-white px-5 py-4 text-sm text-error">
            {ws.error}
          </div>
        ) : null}

        {hasData ? (
          <div
            className="rounded-xl border border-border bg-surface-white shadow-none"
            style={{
              height: `max(280px, min(calc(100vh - 200px), ${gridContentHeight}px))`,
            }}
          >
            <div className="ag-theme-quartz h-full w-full">
              <AgGridReact<AgGridRowData>
                ref={gridRef}
                theme="legacy"
                rowData={agRowData}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                rowHeight={rowHeight}
                headerHeight={56}
                groupHeaderHeight={28}
                stopEditingWhenCellsLoseFocus
                suppressDragLeaveHidesColumns
              />
            </div>
          </div>
        ) : (
          <section className="flex min-h-[280px] items-center justify-center rounded-xl border border-border bg-surface-white px-6 py-10 text-center">
            <div className="max-w-lg">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary">
                <FileSpreadsheet aria-hidden="true" className="h-6 w-6" />
              </div>
              <h2 className="text-base font-semibold text-text-primary">
                Grid data isn’t ready yet
              </h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Assign reviewers and choose an extraction template for an included paper. Its fields will appear here once the assignment is ready.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
