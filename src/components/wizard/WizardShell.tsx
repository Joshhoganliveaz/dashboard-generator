"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import type { DashboardType } from "@/lib/supabase/types";

interface StepDefinition {
  number: number;
  label: string;
}

function getSteps(dashboardType: DashboardType): StepDefinition[] {
  const base: StepDefinition[] = [
    { number: 1, label: "Type" },
    { number: 2, label: "Client Info" },
  ];

  if (dashboardType === "buyer") {
    base.push({ number: 3, label: "Search Criteria" });
  } else {
    base.push({ number: 3, label: "Property Data" });
  }

  if (dashboardType === "buyer") {
    base.push({ number: 4, label: "Neighborhoods" });
  } else {
    base.push({ number: 4, label: "Market Analysis" });
  }

  base.push({ number: 5, label: "Preview & Edit" });
  base.push({ number: 6, label: "Review & Publish" });

  return base;
}

interface WizardShellProps {
  currentStep: number;
  totalSteps?: number;
  dashboardType: DashboardType;
  onStepClick: (step: number) => void;
  saving: boolean;
  onSave?: () => Promise<void>;
  children: React.ReactNode;
}

export default function WizardShell({
  currentStep,
  dashboardType,
  onStepClick,
  saving,
  onSave,
  children,
}: WizardShellProps) {
  const steps = getSteps(dashboardType);
  const router = useRouter();
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [exitSaving, setExitSaving] = useState(false);

  const handleExit = () => {
    setShowExitDialog(true);
  };

  const handleExitWithSave = async () => {
    setExitSaving(true);
    try {
      if (onSave) await onSave();
    } catch {
      // Save failed, still navigate — user chose to leave
    }
    setExitSaving(false);
    setShowExitDialog(false);
    router.push("/");
  };

  const handleExitWithoutSave = () => {
    setShowExitDialog(false);
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Exit Confirmation Dialog */}
      {showExitDialog && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6">
            <h3 className="text-lg font-display font-bold text-slate mb-2">Leave Wizard?</h3>
            <p className="text-sm text-slate-light mb-6">Would you like to save your progress before leaving?</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleExitWithSave}
                disabled={exitSaving}
                className="w-full bg-terra text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-terra-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {exitSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save & Exit"}
              </button>
              <button
                onClick={handleExitWithoutSave}
                disabled={exitSaving}
                className="w-full bg-sand-pale text-slate px-4 py-2.5 rounded-lg font-semibold hover:bg-sand transition-colors disabled:opacity-60"
              >
                Exit Without Saving
              </button>
              <button
                onClick={() => setShowExitDialog(false)}
                disabled={exitSaving}
                className="w-full text-slate-light px-4 py-2 rounded-lg text-sm hover:text-slate transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-slate text-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button onClick={handleExit} className="text-left hover:opacity-80 transition-opacity">
            <h1 className="text-xl font-display font-bold">Dashboard Wizard</h1>
            <p className="text-sm opacity-70">
              {dashboardType === "sell"
                ? "Sell Dashboard"
                : dashboardType === "buyer"
                ? "Buyer Dashboard"
                : "Buy / Sell Dashboard"}
            </p>
          </button>
          {saving && (
            <div className="flex items-center gap-2 text-sm text-sand">
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </div>
          )}
        </div>
      </header>

      {/* Step Navigation Bar */}
      <nav className="bg-white border-b border-sand-pale">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center gap-1 py-3 overflow-x-auto">
            {steps.map((step) => {
              const isCompleted = step.number < currentStep;
              const isCurrent = step.number === currentStep;
              const isClickable = step.number < currentStep && step.number > 1;
              const isDisabled = step.number > currentStep || step.number === 1;

              return (
                <button
                  key={step.number}
                  onClick={() => isClickable && onStepClick(step.number)}
                  disabled={isDisabled || saving}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isCurrent
                      ? "bg-terra/10 text-terra"
                      : isCompleted
                      ? "text-sage hover:bg-sage/10 cursor-pointer"
                      : "text-slate-light/50 cursor-not-allowed"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      isCurrent
                        ? "bg-terra text-white"
                        : isCompleted
                        ? "bg-sage text-white"
                        : "bg-sand-pale text-slate-light"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      step.number
                    )}
                  </span>
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
