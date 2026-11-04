import React from "react";
import AIProjectSetupWizard from "../../../pages/projects/AIProjectSetupWizard";

interface ProjectSetupSectionProps {
  projectId: string;
  projectTitle?: string;
  projectDomain?: string;
  isProjectSetupReady: boolean;
  onSetupSaved?: () => void;
  embedded?: boolean;
  hideEditButton?: boolean;
  hidePicoc?: boolean;
  hideResearchQuestions?: boolean;
}

const ProjectSetupSection: React.FC<ProjectSetupSectionProps> = ({
  projectId,
  projectTitle,
  projectDomain,
  onSetupSaved,
  embedded = true,
  hideEditButton = false,
  hidePicoc = false,
  hideResearchQuestions = false,
}) => {
  return (
    <div className="space-y-6">
      <AIProjectSetupWizard
        embedded={embedded}
        projectId={projectId}
        projectTitle={projectTitle}
        projectDomain={projectDomain}
        onSetupSaved={onSetupSaved}
        hideEditButton={hideEditButton}
        hidePicoc={hidePicoc}
        hideResearchQuestions={hideResearchQuestions}
      />
    </div>
  );
};

export default ProjectSetupSection;
