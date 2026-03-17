"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Upload, FileText, X, Loader2, AlertCircle, CheckCircle2, ImagePlus } from "lucide-react";
import { useGenerateDashboard } from "@/hooks/useGenerateDashboard";
import CompReviewPanel from "@/components/CompReviewPanel";
import type { DashboardWithData } from "@/lib/supabase/types";
import type { CompSale, SubjectProperty } from "@/lib/types";

interface StepMarketDataProps {
  dashboard: DashboardWithData;
  goToStep: (step: number, data?: Partial<DashboardWithData>) => Promise<void>;
  updateDashboardData: (updates: Partial<DashboardWithData>) => void;
  saving: boolean;
  onGeneratedHtml?: (html: string) => void;
}

export default function StepMarketData({
  dashboard,
  goToStep,
  updateDashboardData,
  saving,
  onGeneratedHtml,
}: StepMarketDataProps) {
  const {
    step,
    message,
    progress,
    html,
    error,
    warnings,
    reviewComps,
    csvResultCache,
    mlsDataCache,
    loanDataCache,
    generate,
    continueWithComps,
    cancel,
    reset,
  } = useGenerateDashboard();

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [cromfordFiles, setCromfordFiles] = useState<File[]>([]);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const cromfordInputRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef(false);

  // For buyer dashboards, step 4 may have simplified flow
  const isBuyer = dashboard.type === "buyer";

  // Build SubjectProperty from sell_data for CompReviewPanel
  const subject: SubjectProperty = {
    beds: dashboard.sell_data?.beds ?? 0,
    baths: dashboard.sell_data?.baths ?? 0,
    sqft: dashboard.sell_data?.sqft ?? 0,
    yearBuilt: dashboard.sell_data?.year_built ?? 0,
    pool: dashboard.sell_data?.pool ?? false,
    stories: dashboard.sell_data?.stories ?? 1,
  };

  // Handle generation complete -- save results to Supabase
  useEffect(() => {
    if (step !== "complete" || !html || savedRef.current) return;
    savedRef.current = true;

    // Extract CONFIG from generated HTML if present
    let config: Record<string, unknown> = {};
    try {
      const match = html.match(/<script[^>]*id=["']dashboard-config["'][^>]*>([\s\S]*?)<\/script>/);
      if (match?.[1]) {
        config = JSON.parse(match[1]);
      }
    } catch {
      // Config extraction optional -- proceed without it
    }

    // Build sell_data updates from config or cached pipeline data
    const sellUpdates: Record<string, unknown> = {};
    const comps = (config.comps as CompSale[]) ?? [];
    if (comps.length > 0) sellUpdates.comps = comps;
    if (config.market_metrics) sellUpdates.market_metrics = config.market_metrics;
    if (config.competition) sellUpdates.competition = config.competition;
    if (config.pricing_strategy) sellUpdates.pricing_strategy = config.pricing_strategy;
    if (config.property_highlights) sellUpdates.property_highlights = config.property_highlights;
    if (config.market_snapshot) sellUpdates.market_snapshot = config.market_snapshot;
    if (config.prep_items) sellUpdates.prep_items = config.prep_items;
    if (config.marketing_plan) sellUpdates.marketing_plan = config.marketing_plan;
    if (config.timeline) sellUpdates.timeline = config.timeline;
    if (config.features) sellUpdates.features = config.features;
    if (config.upgrades) sellUpdates.upgrades = config.upgrades;
    if (config.cromford_metrics) sellUpdates.cromford_metrics = config.cromford_metrics;
    if (config.cromford_takeaway) sellUpdates.cromford_takeaway = config.cromford_takeaway;
    if (config.estimated_sale_price) sellUpdates.estimated_sale_price = config.estimated_sale_price;

    // Save sell_data updates to Supabase via API
    if (Object.keys(sellUpdates).length > 0) {
      fetch(`/api/dashboard/${dashboard.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sell_data: sellUpdates }),
      }).catch((err) => {
        console.warn("Failed to persist generation results:", err);
      });
    }

    // Update local wizard state
    if (dashboard.sell_data) {
      updateDashboardData({
        sell_data: { ...dashboard.sell_data, ...sellUpdates } as typeof dashboard.sell_data,
      });
    }

    // Pass HTML to parent for preview step
    onGeneratedHtml?.(html);
  }, [step, html, dashboard.id, dashboard.sell_data, updateDashboardData, onGeneratedHtml]);

  // Reset savedRef when going back to idle
  useEffect(() => {
    if (step === "idle") {
      savedRef.current = false;
    }
  }, [step]);

  const handleAnalyze = useCallback(() => {
    if (!csvFile && !isBuyer) return;

    const fd = new FormData();
    fd.append("templateType", dashboard.type);
    fd.append(
      "clientDetails",
      JSON.stringify({
        clientNames: dashboard.client_names,
        fullName: dashboard.full_name,
        email: dashboard.email,
        address: dashboard.sell_data?.address,
        cityStateZip: dashboard.sell_data?.city_state_zip,
        subdivision: dashboard.sell_data?.subdivision,
        communityName: dashboard.sell_data?.community_name,
        agentKey: dashboard.agent_key,
        loanPayoff: dashboard.sell_data?.loan_payoff,
        listingBrokerPct: dashboard.sell_data?.listing_broker_pct,
      })
    );

    if (csvFile) {
      fd.append("csv", csvFile);
    }

    // Attach MLS data from step 3 if available
    if (dashboard.sell_data) {
      fd.append("mlsData", JSON.stringify(dashboard.sell_data));
    }

    for (const cf of cromfordFiles) {
      fd.append("cromford", cf);
    }

    generate(fd);
  }, [csvFile, cromfordFiles, dashboard, generate, isBuyer]);

  const handleDrop = useCallback(
    (e: React.DragEvent, type: "csv" | "cromford") => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      if (type === "csv") {
        const csv = files.find((f) => f.name.endsWith(".csv"));
        if (csv) setCsvFile(csv);
      } else {
        const images = files.filter((f) => f.type.startsWith("image/"));
        if (images.length > 0) {
          setCromfordFiles((prev) => [...prev, ...images]);
        }
      }
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // For buyer dashboards, show a simplified generation trigger
  if (isBuyer) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8">
        <h2 className="text-xl font-display font-bold text-slate mb-2">
          Generate Buyer Dashboard
        </h2>
        <p className="text-sm text-slate-light mb-6">
          Your buyer dashboard will be generated from the search criteria and neighborhood data.
        </p>

        {step === "idle" && (
          <button
            onClick={handleAnalyze}
            className="bg-terra text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-terra-dark transition-colors"
          >
            Generate Dashboard
          </button>
        )}

        {step !== "idle" && step !== "complete" && step !== "error" && step !== "review_comps" && (
          <ProgressDisplay message={message} progress={progress} warnings={warnings} onCancel={cancel} />
        )}

        {step === "complete" && (
          <CompletionDisplay onContinue={() => goToStep(5)} />
        )}

        {step === "error" && (
          <ErrorDisplay error={error} onRetry={reset} />
        )}

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-sand-pale">
          <button
            onClick={() => goToStep(2)}
            disabled={saving}
            className="px-5 py-2.5 border border-sand rounded-lg text-slate text-sm font-medium hover:bg-sand-pale transition-colors disabled:opacity-50"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // ----- SELL / BUYSELL flow -----

  // Sub-state 1: File Upload
  if (step === "idle") {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8">
        <h2 className="text-xl font-display font-bold text-slate mb-2">
          Market Analysis
        </h2>
        <p className="text-sm text-slate-light mb-6">
          Upload the ARMLS comparable sales CSV to analyze the market. Optionally add Cromford
          screenshots for market trend data.
        </p>

        {/* CSV Upload */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate mb-2">
            ARMLS Comparable Sales CSV <span className="text-red-400">*</span>
          </label>
          <div
            onDrop={(e) => handleDrop(e, "csv")}
            onDragOver={handleDragOver}
            onClick={() => csvInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              csvFile
                ? "border-sage bg-sage/5"
                : "border-sand hover:border-terra/40 hover:bg-sand-pale/30"
            }`}
          >
            {csvFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-5 h-5 text-sage" />
                <span className="text-sm font-medium text-slate">{csvFile.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCsvFile(null);
                  }}
                  className="p-1 hover:bg-sand-pale rounded"
                >
                  <X className="w-4 h-4 text-slate-light" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-sand mx-auto mb-2" />
                <p className="text-sm text-slate-light">
                  Drop your ARMLS CSV here or click to browse
                </p>
                <p className="text-xs text-sand mt-1">Accepts .csv files</p>
              </>
            )}
          </div>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setCsvFile(file);
            }}
          />
        </div>

        {/* Cromford Screenshots */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate mb-2">
            Cromford Market Screenshots <span className="text-xs text-slate-light font-normal">(optional)</span>
          </label>
          <div
            onDrop={(e) => handleDrop(e, "cromford")}
            onDragOver={handleDragOver}
            onClick={() => cromfordInputRef.current?.click()}
            className="border-2 border-dashed border-sand rounded-lg p-4 text-center cursor-pointer hover:border-terra/40 hover:bg-sand-pale/30 transition-colors"
          >
            {cromfordFiles.length > 0 ? (
              <div className="space-y-2">
                {cromfordFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-center gap-2">
                    <ImagePlus className="w-4 h-4 text-sage" />
                    <span className="text-sm text-slate">{f.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCromfordFiles((prev) => prev.filter((_, idx) => idx !== i));
                      }}
                      className="p-0.5 hover:bg-sand-pale rounded"
                    >
                      <X className="w-3 h-3 text-slate-light" />
                    </button>
                  </div>
                ))}
                <p className="text-xs text-slate-light mt-1">Click or drop to add more</p>
              </div>
            ) : (
              <>
                <ImagePlus className="w-6 h-6 text-sand mx-auto mb-1" />
                <p className="text-sm text-slate-light">
                  Drop Cromford screenshots here or click to browse
                </p>
                <p className="text-xs text-sand mt-1">Accepts image files</p>
              </>
            )}
          </div>
          <input
            ref={cromfordInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) setCromfordFiles((prev) => [...prev, ...files]);
            }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-sand-pale">
          <button
            onClick={() => goToStep(2)}
            disabled={saving}
            className="px-5 py-2.5 border border-sand rounded-lg text-slate text-sm font-medium hover:bg-sand-pale transition-colors disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={handleAnalyze}
            disabled={!csvFile || saving}
            className="bg-terra text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-terra-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Analyze Market Data
          </button>
        </div>
      </div>
    );
  }

  // Sub-state 2: SSE Progress
  if (
    step === "parsing_csv" ||
    step === "extracting_mls" ||
    step === "reading_cromford" ||
    step === "reading_tax_records" ||
    step === "researching" ||
    step === "generating_content" ||
    step === "assembling"
  ) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8">
        <h2 className="text-xl font-display font-bold text-slate mb-6">
          Generating Market Analysis
        </h2>
        <ProgressDisplay message={message} progress={progress} warnings={warnings} onCancel={cancel} />
      </div>
    );
  }

  // Sub-state 3: Comp Review
  if (step === "review_comps" && reviewComps) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8">
        <h2 className="text-xl font-display font-bold text-slate mb-2">
          Review Comparable Sales
        </h2>
        <p className="text-sm text-slate-light mb-4">
          Toggle comps on or off, then continue to generate the dashboard narrative.
        </p>
        <CompReviewPanel
          comps={reviewComps}
          subject={subject}
          loanData={loanDataCache}
          onContinue={(approvedComps, loanOverride) =>
            continueWithComps(approvedComps, loanOverride)
          }
          onCancel={() => reset()}
        />
      </div>
    );
  }

  // Sub-state 4: Complete
  if (step === "complete") {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8">
        <CompletionDisplay onContinue={() => goToStep(5)} />
      </div>
    );
  }

  // Sub-state 5: Error
  if (step === "error") {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8">
        <ErrorDisplay error={error} onRetry={reset} />
        <div className="mt-6 pt-4 border-t border-sand-pale">
          <button
            onClick={() => goToStep(2)}
            className="px-5 py-2.5 border border-sand rounded-lg text-slate text-sm font-medium hover:bg-sand-pale transition-colors"
          >
            Back to Property Data
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ---- Sub-components ----

function ProgressDisplay({
  message,
  progress,
  warnings,
  onCancel,
}: {
  message: string;
  progress: number;
  warnings: string[];
  onCancel: () => void;
}) {
  return (
    <div>
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate font-medium">{message}</span>
          <span className="text-sm text-slate-light">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-sand-pale rounded-full h-2.5">
          <div
            className="bg-terra h-2.5 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mb-4 space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-1.5">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Spinner + Cancel */}
      <div className="flex items-center justify-between mt-6">
        <div className="flex items-center gap-2 text-sm text-slate-light">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Processing...</span>
        </div>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-light hover:text-slate border border-sand rounded-lg hover:bg-sand-pale transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function CompletionDisplay({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="text-center py-6">
      <CheckCircle2 className="w-12 h-12 text-sage mx-auto mb-3" />
      <h3 className="text-lg font-display font-bold text-slate mb-1">
        Analysis Complete
      </h3>
      <p className="text-sm text-slate-light mb-6">
        Market analysis and dashboard content have been generated successfully.
      </p>
      <button
        onClick={onContinue}
        className="bg-terra text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-terra-dark transition-colors"
      >
        Continue to Preview
      </button>
    </div>
  );
}

function ErrorDisplay({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="text-center py-6">
      <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
      <h3 className="text-lg font-display font-bold text-slate mb-1">
        Generation Failed
      </h3>
      <p className="text-sm text-slate-light mb-2 max-w-md mx-auto">
        {error || "An unexpected error occurred during generation."}
      </p>
      <p className="text-xs text-slate-light mb-6">
        If the narrative generation failed, the market data may still be available. Try again or go back to adjust your inputs.
      </p>
      <button
        onClick={onRetry}
        className="bg-terra text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-terra-dark transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
