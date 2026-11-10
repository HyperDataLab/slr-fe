import { describe, expect, it } from "vitest";
import type { SlrCorpusOptions } from "../../../../services/slrArtifactsService";
import {
  DEFAULT_FORM_STATE,
  EXCLUDE_FIELD,
  buildGenerateOptions,
  dimensionChoices,
  parseDimension,
} from "./generateOptions";

describe("buildGenerateOptions", () => {
  it("sends only the defaults when nothing was changed", () => {
    expect(buildGenerateOptions(DEFAULT_FORM_STATE)).toEqual({
      options: { a3Mode: "ai", contextGroupBy: "outcome", sparseThreshold: 1 },
    });
  });

  it("builds a gap map, research question and field role overrides", () => {
    const built = buildGenerateOptions({
      ...DEFAULT_FORM_STATE,
      a3Mode: "ai",
      researchQuestionId: "rq1",
      sparseThreshold: "3",
      gapRows: "role:intervention",
      gapColumns: "field:section:field-1",
      fieldRoles: { f1: "outcome", f2: EXCLUDE_FIELD, f3: "", f4: "not-a-role" },
    });
    expect(built.options).toEqual({
      a3Mode: "ai",
      contextGroupBy: "outcome",
      sparseThreshold: 3,
      researchQuestionId: "rq1",
      gapMap: { rows: { role: "intervention" }, columns: { field_id: "section:field-1" } },
      fieldRoles: { f1: "outcome", f2: null },
    });
  });

  it("requires both gap map sides or neither", () => {
    expect(buildGenerateOptions({ ...DEFAULT_FORM_STATE, gapRows: "role:outcome" }).error).toMatch(/both gap map rows and columns/);
    expect(buildGenerateOptions({ ...DEFAULT_FORM_STATE, gapColumns: "role:outcome" }).error).toMatch(/both gap map rows and columns/);
  });

  it("rejects a sparse threshold the server would reject", () => {
    for (const value of ["0", "21", "1.5", "", "abc"]) {
      expect(buildGenerateOptions({ ...DEFAULT_FORM_STATE, sparseThreshold: value }).error).toMatch(/whole number from 1 to 20/);
    }
    expect(buildGenerateOptions({ ...DEFAULT_FORM_STATE, sparseThreshold: "20" }).options?.sparseThreshold).toBe(20);
  });
});

describe("parseDimension", () => {
  it("reads roles and fields and refuses anything else", () => {
    expect(parseDimension("role:outcome")).toEqual({ role: "outcome" });
    expect(parseDimension("field:abc")).toEqual({ field_id: "abc" });
    expect(parseDimension("role:unknown")).toBeNull();
    expect(parseDimension("field:")).toBeNull();
    expect(parseDimension("")).toBeNull();
    expect(parseDimension("outcome")).toBeNull();
  });
});

describe("dimensionChoices", () => {
  it("offers only roles and fields the corpus has", () => {
    const corpus: SlrCorpusOptions = {
      research_questions: [],
      field_roles: [
        { field_id: "f1", field_name: "Outcome", section_name: "Results", role: "outcome" },
        { field_id: "f2", field_name: "Notes", section_name: "Misc", role: null },
        { field_id: "f3", field_name: "Result 2", section_name: "Results", role: "outcome" },
      ],
    };
    expect(dimensionChoices(corpus).map((choice) => choice.value)).toEqual(["role:outcome", "field:f1", "field:f2", "field:f3"]);
    expect(dimensionChoices(undefined)).toEqual([]);
  });
});
