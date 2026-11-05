import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import {
  aiProjectSetupService,
  type GeneratePicocResponse,
  type ProjectSetupDetailsResponse,
  type ResearchQuestionInputDto,
  type UpdateSetupRequest,
} from "../../../../services/aiProjectSetupService.ts";
import { toastError, toastSuccess, toastWarning } from "../../../../utils/toast";
import { DEFAULT_TOPIC, EMPTY_PICOC, EMPTY_SCOPE } from "../constants";
import { projectQueryKeys } from "../../../../constants/projectQueryKeys";
import type { RootState } from "../../../../redux/store";
import type {
  EditableResearchQuestion,
  PicoCForm,
  ScopeForm,
  SetupSnapshot,
  Step,
  ViewMode,
} from "../types";

export function useAIProjectSetupState(projectId: string, onSetupSaved?: () => void) {
  const queryClient = useQueryClient();
  const currentUserId = useSelector((state: RootState) => state.auth.user?.id ?? "anonymous");
  const setupDetailsKey = useMemo(
    () => projectQueryKeys.setupDetails(projectId, currentUserId),
    [projectId, currentUserId],
  );
  const [viewMode, setViewMode] = useState<ViewMode>("wizard");
  const [isLoadingSetup, setIsLoadingSetup] = useState(true);

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isAnalyzingIdea, setIsAnalyzingIdea] = useState(false);
  const [isGeneratingPicoc, setIsGeneratingPicoc] = useState(false);
  const [isGeneratingRQ, setIsGeneratingRQ] = useState(false);
  const [isSavingSetup, setIsSavingSetup] = useState(false);

  const [topic, setTopic] = useState(DEFAULT_TOPIC);
  const [language, setLanguage] = useState("English");
  const [scopeForm, setScopeForm] = useState<ScopeForm>(EMPTY_SCOPE);
  const [picocForm, setPicocForm] = useState<PicoCForm>(EMPTY_PICOC);

  const [rqOptions, setRqOptions] = useState<string[]>([]);
  const [selectedRqIndexes, setSelectedRqIndexes] = useState<number[]>([]);
  const [customRQInput, setCustomRQInput] = useState("");
  const [customRQs, setCustomRQs] = useState<string[]>([]);

  const [editResearchQuestions, setEditResearchQuestions] = useState<EditableResearchQuestion[]>([]);
  const [editNewRQInput, setEditNewRQInput] = useState("");
  const [setupSnapshot, setSetupSnapshot] = useState<SetupSnapshot | null>(null);

  const finalizedWizardRQs = useMemo(() => {
    const selectedSuggestedRQs = selectedRqIndexes
      .map((index) => rqOptions[index])
      .filter((rq): rq is string => Boolean(rq));

    return [...selectedSuggestedRQs, ...customRQs];
  }, [customRQs, rqOptions, selectedRqIndexes]);

  const isStep2Valid = scopeForm.objectives.trim().length > 0 && scopeForm.domain.trim().length > 0;

  const isStep3Valid =
    picocForm.population.trim().length > 0 &&
    picocForm.intervention.trim().length > 0 &&
    picocForm.comparator.trim().length > 0 &&
    picocForm.outcome.trim().length > 0 &&
    picocForm.context.trim().length > 0;

  const completionMap = {
    1: currentStep > 1,
    2: currentStep > 2,
    3: currentStep > 3,
    4: currentStep > 4,
    5: viewMode === "summary",
  } as const;

  const mapPicocResponse = (picoc?: Partial<GeneratePicocResponse> | null): PicoCForm => ({
    population: picoc?.population ?? "",
    intervention: picoc?.intervention ?? "",
    comparator: picoc?.comparator ?? "",
    outcome: picoc?.outcome ?? "",
    context: picoc?.context ?? "",
  });

  const hasExistingSetup = (data?: Partial<ProjectSetupDetailsResponse> | null) => {
    if (!data) return false;
    const hasMainFields =
      Boolean(data.researchTopic?.trim()) ||
      Boolean(data.researchObjective?.trim()) ||
      Boolean(data.domain?.trim());

    const hasPicoc =
      Boolean(data.picoc?.population?.trim()) ||
      Boolean(data.picoc?.intervention?.trim()) ||
      Boolean(data.picoc?.comparator?.trim()) ||
      Boolean(data.picoc?.outcome?.trim()) ||
      Boolean(data.picoc?.context?.trim());

    return hasMainFields || hasPicoc || (data.researchQuestions?.length ?? 0) > 0;
  };

  const applySetupData = useCallback((data: ProjectSetupDetailsResponse) => {
    const mappedRQs: EditableResearchQuestion[] = (data?.researchQuestions ?? []).map((rq) => ({
      id: rq.id,
      questionText: rq.questionText,
    }));

    const snapshot: SetupSnapshot = {
      topic: data?.researchTopic ?? "",
      language: data?.language ?? "English",
      scope: {
        objectives: data?.researchObjective ?? "",
        domain: data?.domain ?? "",
      },
      picoc: mapPicocResponse(data?.picoc),
      researchQuestions: mappedRQs,
    };

    setTopic(snapshot.topic);
    setLanguage(snapshot.language);
    setScopeForm(snapshot.scope);
    setPicocForm(snapshot.picoc);
    setEditResearchQuestions(snapshot.researchQuestions);
    setSetupSnapshot(snapshot);
  }, []);

  const loadSetupDetails = useCallback(async (forceRefresh = false) => {
    if (!projectId) {
      setIsLoadingSetup(false);
      setViewMode("wizard");
      return;
    }

    setIsLoadingSetup(true);
    try {
      const response = await queryClient.fetchQuery({
        queryKey: setupDetailsKey,
        queryFn: () => aiProjectSetupService.getSetupDetails(projectId),
        staleTime: forceRefresh ? 0 : 60_000,
      });
      if (!response?.isSuccess || !response?.data) {
        setViewMode("wizard");
        return;
      }

      if (hasExistingSetup(response.data)) {
        applySetupData(response.data);
        setViewMode("summary");
      } else {
        setViewMode("wizard");
      }
    } catch {
      // Setup details not yet initialized or network fallback - cleanly default to wizard mode
      setViewMode("wizard");
    } finally {
      setIsLoadingSetup(false);
    }
  }, [applySetupData, projectId, queryClient, setupDetailsKey]);

  useEffect(() => {
    void loadSetupDetails();
  }, [loadSetupDetails]);

  const handleAIFallback = () => {
    toastWarning(
      "AI generation failed",
      "AI generation failed or is busy. Please proceed manually.",
    );
  };

  const handleAnalyzeIdea = async () => {
    if (!topic.trim()) return;
    if (!projectId) {
      toastError("Missing project", "Project ID is required to analyze topic.");
      return;
    }

    setIsAnalyzingIdea(true);

    try {
      const response = await aiProjectSetupService.analyzeTopic(projectId, { topic, language });
      const nextScope: ScopeForm = {
        objectives: response.data?.objectives ?? "",
        domain: response.data?.domain ?? "",
      };

      if (!response.isSuccess || !response.data) {
        handleAIFallback();
        setScopeForm(EMPTY_SCOPE);
      } else {
        setScopeForm(nextScope);
      }
    } catch {
      handleAIFallback();
      setScopeForm(EMPTY_SCOPE);
    } finally {
      setIsAnalyzingIdea(false);
    }
  };

  const handleGeneratePicoc = async () => {
    if (!isStep2Valid) return;
    if (!projectId) {
      toastError("Missing project", "Project ID is required to generate PICO-C.");
      return;
    }

    setIsGeneratingPicoc(true);
    try {
      const response = await aiProjectSetupService.generatePicoc(projectId, {
        topic,
        objectives: scopeForm.objectives,
        domain: scopeForm.domain,
        language,
      });

      const nextPicoc = mapPicocResponse({
        population: response.data?.population ?? "",
        intervention: response.data?.intervention ?? "",
        comparator: response.data?.comparator ?? "",
        outcome: response.data?.outcome ?? "",
        context: response.data?.context ?? "",
      });

      if (!response.isSuccess || !response.data) {
        handleAIFallback();
        setPicocForm(EMPTY_PICOC);
      } else {
        setPicocForm(nextPicoc);
      }
    } catch {
      handleAIFallback();
      setPicocForm(EMPTY_PICOC);
    } finally {
      setIsGeneratingPicoc(false);
    }
  };

  const handleGenerateRQ = async () => {
    if (!isStep3Valid) return;
    if (!projectId) {
      toastError("Missing project", "Project ID is required to generate research questions.");
      return;
    }

    setIsGeneratingRQ(true);

    try {
      const response = await aiProjectSetupService.generateRqs(projectId, {
        topic,
        objectives: scopeForm.objectives,
        domain: scopeForm.domain,
        language,
        picoc: {
          population: picocForm.population,
          intervention: picocForm.intervention,
          comparator: picocForm.comparator,
          outcome: picocForm.outcome,
          context: picocForm.context,
        },
      });

      const suggestedQuestions = (response.data?.suggestedQuestions ?? []).filter(
        (question: string) => question.trim().length > 0,
      );

      if (!response.isSuccess || !response.data || suggestedQuestions.length === 0) {
        handleAIFallback();
        setRqOptions([]);
        setSelectedRqIndexes([]);
      } else {
        setRqOptions(suggestedQuestions);
        setSelectedRqIndexes(suggestedQuestions.map((_: string, index: number) => index));
      }
    } catch {
      handleAIFallback();
      setRqOptions([]);
      setSelectedRqIndexes([]);
    } finally {
      setCustomRQInput("");
      setCustomRQs([]);
      setIsGeneratingRQ(false);
    }
  };

  const handleToggleSuggestedRQ = (index: number) => {
    setSelectedRqIndexes((prev) => {
      if (prev.includes(index)) {
        return prev.filter((item) => item !== index);
      }
      return [...prev, index];
    });
  };

  const handleAddCustomRQ = () => {
    const nextValue = customRQInput.trim();
    if (!nextValue) return;
    setCustomRQs((prev) => [...prev, nextValue]);
    setCustomRQInput("");
  };

  const handleRemoveCustomRQ = (index: number) => {
    setCustomRQs((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const toResearchQuestionPayload = (questions: EditableResearchQuestion[]): ResearchQuestionInputDto[] => {
    return questions
      .map((rq) => ({
        id: rq.id,
        questionText: rq.questionText.trim(),
      }))
      .filter((rq) => rq.questionText.length > 0);
  };

  const buildUpdatePayload = (questions: EditableResearchQuestion[]): UpdateSetupRequest => {
    return {
      researchTopic: topic,
      researchObjective: scopeForm.objectives,
      domain: scopeForm.domain,
      language,
      picoc: {
        population: picocForm.population,
        intervention: picocForm.intervention,
        comparator: picocForm.comparator,
        outcome: picocForm.outcome,
        context: picocForm.context,
      },
      finalResearchQuestions: toResearchQuestionPayload(questions),
    };
  };

  const handleSaveSetup = async (questions: EditableResearchQuestion[]) => {
    if (!projectId) {
      toastError("Missing project", "Project ID is required to save setup details.");
      return;
    }

    setIsSavingSetup(true);
    try {
      const payload = buildUpdatePayload(questions);
      const response = await aiProjectSetupService.updateSetup(projectId, payload);
      if (!response.isSuccess) {
        throw new Error(response.message || "Failed to save setup details.");
      }

      await queryClient.invalidateQueries({
        queryKey: setupDetailsKey,
        exact: true,
        refetchType: "none",
      });
      await loadSetupDetails(true);
      setViewMode("summary");
      toastSuccess("Setup saved", "Project setup details were updated successfully.");
      onSetupSaved?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save setup details.";
      toastError("Save failed", message);
    } finally {
      setIsSavingSetup(false);
    }
  };

  const handleConfirmAndReview = () => {
    setCurrentStep(5);
  };

  const handleSaveWizardSetup = async () => {
    const questions: EditableResearchQuestion[] = finalizedWizardRQs.map((questionText) => ({
      id: null,
      questionText,
    }));
    await handleSaveSetup(questions);
  };

  const handleEnterEditMode = () => {
    setEditNewRQInput("");
    setViewMode("edit");
  };

  const handleCancelEditMode = () => {
    if (setupSnapshot) {
      setTopic(setupSnapshot.topic);
      setLanguage(setupSnapshot.language);
      setScopeForm(setupSnapshot.scope);
      setPicocForm(setupSnapshot.picoc);
      setEditResearchQuestions(setupSnapshot.researchQuestions);
    }
    setViewMode("summary");
  };

  const handleEditRQTextChange = (index: number, value: string) => {
    setEditResearchQuestions((prev) =>
      prev.map((rq, itemIndex) =>
        itemIndex === index
          ? {
              ...rq,
              questionText: value,
            }
          : rq,
      ),
    );
  };

  const handleAddEditRQ = () => {
    const value = editNewRQInput.trim();
    if (!value) return;

    setEditResearchQuestions((prev) => [...prev, { id: null, questionText: value }]);
    setEditNewRQInput("");
  };

  const handleDeleteEditRQ = (index: number) => {
    setEditResearchQuestions((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  return {
    viewMode,
    isLoadingSetup,
    currentStep,
    isAnalyzingIdea,
    isGeneratingPicoc,
    isGeneratingRQ,
    isSavingSetup,
    topic,
    language,
    scopeForm,
    picocForm,
    rqOptions,
    selectedRqIndexes,
    customRQInput,
    customRQs,
    editResearchQuestions,
    editNewRQInput,
    finalizedWizardRQs,
    isStep2Valid,
    isStep3Valid,
    completionMap,
    setCurrentStep,
    setTopic,
    setLanguage,
    setScopeForm,
    setPicocForm,
    setCustomRQInput,
    setEditNewRQInput,
    handleAnalyzeIdea,
    handleGeneratePicoc,
    handleGenerateRQ,
    handleToggleSuggestedRQ,
    handleAddCustomRQ,
    handleRemoveCustomRQ,
    handleConfirmAndReview,
    handleSaveWizardSetup,
    handleEnterEditMode,
    handleCancelEditMode,
    handleEditRQTextChange,
    handleAddEditRQ,
    handleDeleteEditRQ,
    handleSaveSetup,
  };
}
