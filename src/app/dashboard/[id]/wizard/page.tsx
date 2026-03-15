"use client";

import { Suspense, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { useWizardState } from "@/hooks/useWizardState";
import WizardShell from "@/components/wizard/WizardShell";
import StepTypeSelect from "@/components/wizard/StepTypeSelect";
import StepClientInfo from "@/components/wizard/StepClientInfo";
import StepPropertyExtraction from "@/components/wizard/StepPropertyExtraction";
import StepMarketData from "@/components/wizard/StepMarketData";
import StepPreview from "@/components/wizard/StepPreview";
import StepPublish from "@/components/wizard/StepPublish";

function WizardContent() {
  const params = useParams();
  const dashboardId = params.id as string;

  const {
    dashboard,
    currentStep,
    loading,
    saving,
    error,
    goToStep,
    updateDashboardData,
  } = useWizardState(dashboardId);

  // Store generated HTML for preview in step 5
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const handleGeneratedHtml = useCallback((html: string) => {
    setGeneratedHtml(html);
  }, []);

  // Apply NL edit to generated HTML via the edit API
  const applyEdit = useCallback(async (instruction: string): Promise<boolean> => {
    if (!generatedHtml) return false;
    setIsEditing(true);
    setEditError(null);
    try {
      const res = await fetch("/api/dashboard/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: generatedHtml,
          instruction,
          templateType: dashboard?.type || "houseversary",
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Edit failed" }));
        throw new Error(errBody.error || "Edit failed");
      }
      const { html } = await res.json();
      setGeneratedHtml(html);
      setIsEditing(false);
      return true;
    } catch (err) {
      setIsEditing(false);
      setEditError((err as Error).message);
      return false;
    }
  }, [generatedHtml, dashboard?.type]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-terra animate-spin mx-auto mb-3" />
          <p className="text-slate-light text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-display font-bold text-slate mb-2">
            Dashboard Not Found
          </h2>
          <p className="text-sm text-slate-light mb-4">
            {error || "The dashboard you are looking for does not exist."}
          </p>
          <a
            href="/dashboard/new"
            className="inline-block bg-terra text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-terra-dark transition-colors"
          >
            Create New Dashboard
          </a>
        </div>
      </div>
    );
  }

  // Step 1 redirects back to type selection
  if (currentStep === 1) {
    return <StepTypeSelect />;
  }

  // Render step content based on current step
  function renderStepContent() {
    switch (currentStep) {
      case 2:
        return (
          <StepClientInfo
            dashboard={dashboard!}
            saving={saving}
            goToStep={goToStep}
            updateDashboardData={updateDashboardData}
          />
        );
      case 3:
        return (
          <StepPropertyExtraction
            dashboard={dashboard!}
            saving={saving}
            goToStep={goToStep}
            updateDashboardData={updateDashboardData}
          />
        );
      case 4:
        return (
          <StepMarketData
            dashboard={dashboard!}
            goToStep={goToStep}
            updateDashboardData={updateDashboardData}
            saving={saving}
            onGeneratedHtml={handleGeneratedHtml}
          />
        );
      case 5:
        return (
          <StepPreview
            dashboard={dashboard!}
            generatedHtml={generatedHtml}
            goToStep={goToStep}
            applyEdit={applyEdit}
            isEditing={isEditing}
            editError={editError}
            saving={saving}
          />
        );
      case 6:
        return (
          <StepPublish
            dashboard={dashboard!}
            goToStep={goToStep}
            saving={saving}
          />
        );
      default:
        return null;
    }
  }

  return (
    <WizardShell
      currentStep={currentStep}
      dashboardType={dashboard.type}
      onStepClick={(step) => goToStep(step)}
      saving={saving}
    >
      {renderStepContent()}
    </WizardShell>
  );
}

export default function WizardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-cream flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-terra animate-spin" />
        </div>
      }
    >
      <WizardContent />
    </Suspense>
  );
}