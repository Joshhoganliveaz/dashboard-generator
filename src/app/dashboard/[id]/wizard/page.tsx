"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { useWizardState } from "@/hooks/useWizardState";
import WizardShell from "@/components/wizard/WizardShell";
import StepTypeSelect from "@/components/wizard/StepTypeSelect";

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
  } = useWizardState(dashboardId);

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
          <StepPlaceholder
            title="Client Information"
            description="Enter client details, names, and contact information."
            stepNumber={2}
            onNext={() => goToStep(3)}
            saving={saving}
          />
        );
      case 3:
        return (
          <StepPlaceholder
            title={
              dashboard!.type === "buyer"
                ? "Search Criteria"
                : "Property Data"
            }
            description={
              dashboard!.type === "buyer"
                ? "Define target areas, budget, and must-have features."
                : "Upload MLS data and review property details."
            }
            stepNumber={3}
            onNext={() => goToStep(4)}
            onBack={() => goToStep(2)}
            saving={saving}
          />
        );
      case 4:
        return (
          <StepPlaceholder
            title={
              dashboard!.type === "buyer"
                ? "Neighborhoods"
                : "Market Analysis"
            }
            description={
              dashboard!.type === "buyer"
                ? "Review neighborhood profiles and school districts."
                : "Upload comps CSV and review market analysis."
            }
            stepNumber={4}
            onNext={() => goToStep(5)}
            onBack={() => goToStep(3)}
            saving={saving}
          />
        );
      case 5:
        return (
          <StepPlaceholder
            title="Preview & Edit"
            description="Preview the dashboard and make any final edits."
            stepNumber={5}
            onNext={() => goToStep(6)}
            onBack={() => goToStep(4)}
            saving={saving}
          />
        );
      case 6:
        return (
          <StepPlaceholder
            title="Review & Publish"
            description="Review everything and publish the dashboard."
            stepNumber={6}
            onBack={() => goToStep(5)}
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

// --- Placeholder step component used until real steps are built ---

function StepPlaceholder({
  title,
  description,
  stepNumber,
  onNext,
  onBack,
  saving,
}: {
  title: string;
  description: string;
  stepNumber: number;
  onNext?: () => void;
  onBack?: () => void;
  saving: boolean;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-8">
      <div className="text-center py-8">
        <div className="w-12 h-12 bg-sand-pale rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-lg font-bold text-slate-light">
            {stepNumber}
          </span>
        </div>
        <h2 className="text-xl font-display font-bold text-slate mb-2">
          {title}
        </h2>
        <p className="text-sm text-slate-light max-w-md mx-auto">
          {description}
        </p>
        <p className="text-xs text-sand mt-4">
          This step will be built in a future plan.
        </p>
      </div>

      <div className="flex items-center justify-between mt-8 pt-6 border-t border-sand-pale">
        {onBack ? (
          <button
            onClick={onBack}
            disabled={saving}
            className="px-5 py-2.5 border border-sand rounded-lg text-slate text-sm font-medium hover:bg-sand-pale transition-colors disabled:opacity-50"
          >
            Back
          </button>
        ) : (
          <div />
        )}
        {onNext && (
          <button
            onClick={onNext}
            disabled={saving}
            className="px-5 py-2.5 bg-terra text-white rounded-lg text-sm font-semibold hover:bg-terra-dark transition-colors disabled:opacity-50"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
