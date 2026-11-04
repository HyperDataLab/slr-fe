import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { picocWizardStateService } from "../../../services/picocWizardStateService";
import type { PicocWizardDraft, PicocWizardRecord } from "./types";
import { projectQueryKeys } from "../../../constants/projectQueryKeys";
import type { RootState } from "../../../redux/store";

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "conflict";
export type SaveResult = "saved" | "error" | "conflict" | "skipped";

const AUTOSAVE_DELAY_MS = 1200;

export function draftOf(record: PicocWizardRecord): PicocWizardDraft {
  const { reviewType, currentStep, intent, researchField, keywords, picoc, comparisonNotApplicable } = record;
  return { reviewType, currentStep, intent, researchField, keywords, picoc, comparisonNotApplicable };
}

/**
 * Loads the PICOC draft and autosaves edits. Every save sends the last revision seen; a 409 stops
 * autosave so another member's changes are never silently overwritten.
 */
export function usePicocWizard(projectId: string, canEdit: boolean) {
  const queryClient = useQueryClient();
  const currentUserId = useSelector((state: RootState) => state.auth.user?.id ?? "anonymous");
  const stateKey = useMemo(
    () => projectQueryKeys.picocWizardState(projectId, currentUserId),
    [projectId, currentUserId],
  );
  const [record, setRecord] = useState<PicocWizardRecord | null>(null);
  const [draft, setDraft] = useState<PicocWizardDraft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const revisionRef = useRef(0);
  const draftRef = useRef<PicocWizardDraft | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const conflictRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);
  const savedThisSessionRef = useRef(false);

  const load = useCallback(async (forceRefresh = false) => {
    setLoadError(null);
    try {
      const loaded = await queryClient.fetchQuery({
        queryKey: stateKey,
        queryFn: () => picocWizardStateService.getState(projectId),
        staleTime: forceRefresh ? 0 : 30_000,
      });
      revisionRef.current = loaded.revision;
      conflictRef.current = false;
      dirtyRef.current = false;
      draftRef.current = draftOf(loaded);
      setRecord(loaded);
      setDraft(draftRef.current);
      setSaveStatus("idle");
    } catch {
      setLoadError("Could not load the PICOC draft. Check your connection and try again.");
    }
  }, [projectId, queryClient, stateKey]);

  useEffect(() => {
    void load();
    return () => window.clearTimeout(timerRef.current);
  }, [load]);

  const saveNow = useCallback(async (explicit = false) => {
    window.clearTimeout(timerRef.current);
    if (!canEdit || !draftRef.current || conflictRef.current || savingRef.current) return "skipped" as const;
    savingRef.current = true;
    dirtyRef.current = false;
    setSaveStatus("saving");
    let result: SaveResult = "saved";
    try {
      const saved = await picocWizardStateService.saveState(projectId, revisionRef.current, draftRef.current);
      queryClient.setQueryData(stateKey, saved);
      revisionRef.current = saved.revision;
      setRecord(saved);
      setSaveStatus("saved");
      if (explicit || !savedThisSessionRef.current) picocWizardStateService.track(projectId, "picoc_saved");
      savedThisSessionRef.current = true;
    } catch (error) {
      dirtyRef.current = true;
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        conflictRef.current = true;
        setSaveStatus("conflict");
        result = "conflict";
      } else {
        setSaveStatus("error");
        result = "error";
      }
    } finally {
      savingRef.current = false;
    }
    // Edits made while the request was in flight are saved next.
    if (dirtyRef.current && !conflictRef.current && draftRef.current) {
      timerRef.current = window.setTimeout(() => void saveNow(), AUTOSAVE_DELAY_MS);
    }
    return result;
  }, [canEdit, projectId, queryClient, stateKey]);

  const update = useCallback((change: (current: PicocWizardDraft) => PicocWizardDraft) => {
    if (!canEdit || !draftRef.current) return;
    draftRef.current = change(draftRef.current);
    setDraft(draftRef.current);
    dirtyRef.current = true;
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void saveNow(), AUTOSAVE_DELAY_MS);
  }, [canEdit, saveNow]);

  /** Saves pending edits, then runs the AI consistency gates on that saved revision. */
  const runSemanticCheck = useCallback(async () => {
    await saveNow();
    if (conflictRef.current || dirtyRef.current) return false;
    const checked = await picocWizardStateService.semanticCheck(projectId, revisionRef.current);
    if (checked.revision === revisionRef.current) {
      queryClient.setQueryData(stateKey, checked);
      setRecord(checked);
    }
    return true;
  }, [projectId, queryClient, saveNow, stateKey]);

  const reload = useCallback(() => load(true), [load]);

  return { record, draft, loadError, saveStatus, update, saveNow, reload, runSemanticCheck };
}
