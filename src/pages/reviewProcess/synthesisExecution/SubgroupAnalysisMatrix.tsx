import Select from "../../../components/ui/Select";
import { useMemo, useState } from "react";
import type {
  SynthesisThemeDto,
  SourceDataGroupDto,
  SourceDataValueDto,
} from "../../../types/synthesisExecution";

interface SubgroupAnalysisMatrixProps {
  themes: SynthesisThemeDto[];
  sourceDataGroups: SourceDataGroupDto[];
}

export default function SubgroupAnalysisMatrix({
  themes,
  sourceDataGroups,
}: SubgroupAnalysisMatrixProps) {
  // Filter for categorical groups (heuristic: < 20 unique values)
  const categoricalGroups = useMemo(() => {
    return sourceDataGroups.filter((group) => {
      const uniqueValues = new Set(group.values.map((v) => v.displayValue));
      return uniqueValues.size < 20 && uniqueValues.size > 0;
    });
  }, [sourceDataGroups]);

  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    categoricalGroups[0]?.fieldId ?? "",
  );

  const selectedGroup = useMemo(
    () => categoricalGroups.find((g) => g.fieldId === selectedGroupId),
    [categoricalGroups, selectedGroupId],
  );

  // Extract unique categories from selected group, preserving order of first appearance
  const categories = useMemo(() => {
    if (!selectedGroup) return [];
    const seenValues = new Set<string>();
    const result: SourceDataValueDto[] = [];

    for (const value of selectedGroup.values) {
      if (!seenValues.has(value.displayValue)) {
        seenValues.add(value.displayValue);
        result.push(value);
      }
    }
    return result;
  }, [selectedGroup]);

  // Build category to papers lookup
  const categoryPapersLookup = useMemo(() => {
    const lookup = new Map<string, Set<string>>();
    if (!selectedGroup) return lookup;

    for (const value of selectedGroup.values) {
      if (!lookup.has(value.displayValue)) {
        lookup.set(value.displayValue, new Set());
      }
      lookup.get(value.displayValue)?.add(value.paperTitle);
    }
    return lookup;
  }, [selectedGroup]);

  // Build matrix data
  const matrixData = useMemo(() => {
    if (!selectedGroup) return [];

    return themes.map((theme) => {
      const themeEvidencePapers = new Set(
        theme.evidences.map((e) => e.paperTitle),
      );

      const row = categories.map((category) => {
        const categoryPapers =
          categoryPapersLookup.get(category.displayValue) || new Set();
        const intersection = new Set(
          Array.from(categoryPapers).filter((paper) =>
            themeEvidencePapers.has(paper),
          ),
        );

        return {
          count: intersection.size,
        };
      });

      return { theme, row };
    });
  }, [themes, categories, categoryPapersLookup, selectedGroup]);

  // Find max count for intensity scaling
  const maxCount = useMemo(() => {
    let max = 0;
    for (const { row } of matrixData) {
      for (const cell of row) {
        if (cell.count > max) max = cell.count;
      }
    }
    return Math.max(max, 1);
  }, [matrixData]);

  const getIntensityColor = (count: number) => {
    if (count === 0) return "bg-surface-white";
    const intensity = (count / maxCount) * 100;
    if (intensity <= 25) return "bg-blue-100";
    if (intensity <= 50) return "bg-blue-300";
    if (intensity <= 75) return "bg-blue-500";
    return "bg-blue-700";
  };

  const getTextColor = (count: number) => {
    if (count === 0) return "text-text-secondary/35";
    const intensity = (count / maxCount) * 100;
    if (intensity <= 50) return "text-text-primary";
    return "text-white";
  };

  if (categoricalGroups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-bg-primary px-6 py-10 text-center">
        <p className="text-sm font-medium text-text-secondary">
          No categorical fields available.
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          Select a workspace with categorical extracted data fields.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="subgroup-field-select"
          className="block text-sm font-semibold text-text-primary mb-2"
        >
          Analyze by Field
        </label>
        <Select
          id="subgroup-field-select"
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
          className="min-h-11 w-full rounded-xl border border-border bg-surface-white px-4 py-2 text-sm font-medium text-text-primary shadow-none outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 motion-reduce:transition-none"
        >
          {categoricalGroups.map((group) => (
            <option key={group.fieldId} value={group.fieldId}>
              {group.fieldName}
            </option>
          ))}
        </Select>
      </div>

      {selectedGroup && (
        <>
          <p className="text-sm text-text-secondary">
            Exploring heterogeneity by cross-referencing Themes against{" "}
            <span className="font-semibold text-text-primary">
              {selectedGroup.fieldName}
            </span>
            .
          </p>

          <div className="overflow-x-auto rounded-xl border border-border bg-surface-white shadow-none">
            <table className="w-full text-sm">
              <thead>
                <tr className="sticky top-0 z-20 border-b border-border bg-bg-secondary">
                  <th className="sticky left-0 z-30 bg-surface-white px-6 py-4 text-left font-semibold text-text-primary border-r border-border w-48">
                    Theme
                  </th>
                  {categories.map((category) => (
                    <th
                      key={category.extractedDataValueId}
                      className="px-6 py-4 text-center font-semibold text-text-primary whitespace-nowrap min-w-[120px]"
                    >
                      {category.displayValue}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixData.map(({ theme, row }) => (
                  <tr
                    key={theme.id}
                    className="border-b border-border hover:bg-bg-primary transition-colors"
                  >
                    <td className="sticky left-0 z-10 bg-surface-white px-6 py-4 font-semibold text-text-primary border-r border-border">
                      <div className="flex items-center gap-2">
                        {theme.colorCode && (
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: theme.colorCode }}
                          />
                        )}
                        <span className="line-clamp-2">{theme.name}</span>
                      </div>
                    </td>
                    {row.map((cell, idx) => (
                      <td key={idx} className="px-6 py-4 text-center">
                        <div
                          className={`inline-flex items-center justify-center h-10 w-16 rounded-md font-semibold transition-colors ${getIntensityColor(cell.count)} ${getTextColor(cell.count)}`}
                        >
                          {cell.count > 0 ? cell.count : "—"}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-6 text-xs text-text-secondary pt-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded border border-border bg-surface-white" />
              <span>0 papers</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-blue-100" />
              <span>1–25%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-blue-300" />
              <span>26–50%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-blue-500" />
              <span>51–75%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-blue-700" />
              <span>76–100%</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
