export const projectQueryKeys = {
  setupDetails: (projectId: string, userId: string) =>
    ["project-setup-details", projectId, { userId }] as const,
  picocWizardState: (projectId: string, userId: string) =>
    ["picoc-wizard-state", projectId, { userId }] as const,
};
