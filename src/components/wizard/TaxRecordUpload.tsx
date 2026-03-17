"use client";

import { useState, useMemo } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { classifyLoans, annotateLoansWithRates } from "@/lib/loan-classifier";
import { estimateCurrentBalance } from "@/lib/loan-estimator";
import type { MonsoonExtraction, LoanOrigination } from "@/lib/types";
import type { Refinance } from "@/lib/loan-estimator";

interface TaxRecordUploadProps {
  onExtracted: (data: {
    loanPayoff: number;
    loanAmount: number;
    interestRate: number;
    refiDetected: boolean;
    secondLienAmount: number;
    loanOriginationHistory: LoanOrigination[];
  }) => void;
  purchaseDate?: string | null;
  estimatedSalePrice?: number | null;
}

export default function TaxRecordUpload({
  onExtracted,
  purchaseDate,
}: TaxRecordUploadProps) {
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<MonsoonExtraction | null>(null);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loan selection state
  const [selectedPrimaryIdx, setSelectedPrimaryIdx] = useState<number | null>(null);
  const [helocChecked, setHelocChecked] = useState<boolean[]>([]);

  // Annotated loans derived from extraction
  const annotatedLoans = useMemo(() => {
    if (!extraction) return [];
    return annotateLoansWithRates(extraction.loanOriginationHistory ?? []);
  }, [extraction]);

  const handleUpload = async (file: File) => {
    setExtracting(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append("taxPdf", file);

      const res = await fetch("/api/dashboard/extract-tax", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();

      if (json.success && json.data) {
        const ext = json.data as MonsoonExtraction;
        setExtraction(ext);

        // Initialize loan selection from classifier defaults
        const loans = annotateLoansWithRates(ext.loanOriginationHistory ?? []);
        const classified = classifyLoans(loans, purchaseDate || null);

        // Find index of classifier's currentPrimary in annotated array
        let primaryIdx: number | null = null;
        const helocFlags = new Array(loans.length).fill(false);

        if (classified.currentPrimary) {
          primaryIdx = loans.findIndex(
            (l) =>
              l.date === classified.currentPrimary!.date &&
              l.amount === classified.currentPrimary!.amount
          );
          if (primaryIdx === -1) primaryIdx = null;
        }

        // Mark classifier's secondLiens as HELOC-checked
        for (const sl of classified.secondLiens) {
          const idx = loans.findIndex(
            (l) => l.date === sl.date && l.amount === sl.amount
          );
          if (idx !== -1 && idx !== primaryIdx) {
            helocFlags[idx] = true;
          }
        }

        setSelectedPrimaryIdx(primaryIdx);
        setHelocChecked(helocFlags);
      } else {
        setError(json.error || "Extraction failed. Try a clearer PDF.");
      }
    } catch {
      setError("Network error during extraction.");
    } finally {
      setExtracting(false);
    }
  };

  const handleApply = () => {
    if (!extraction || selectedPrimaryIdx === null || !annotatedLoans[selectedPrimaryIdx]) return;

    const primaryLoan = annotatedLoans[selectedPrimaryIdx];

    // Determine if refi detected: primary is not the earliest loan
    const sorted = [...annotatedLoans].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const isEarliest =
      sorted.length > 0 &&
      primaryLoan.date === sorted[0].date &&
      primaryLoan.amount === sorted[0].amount;
    const refiDetected = !isEarliest && annotatedLoans.length > 1;

    // Sum HELOC-checked loans for secondLienAmount
    const secondLienAmount = annotatedLoans.reduce(
      (sum, loan, i) => (helocChecked[i] ? sum + loan.amount : sum),
      0
    );

    // Build refinance chain for loan payoff estimation:
    // All loans between earliest (original) and selected primary that are refis
    const refinances: Refinance[] = [];
    if (refiDetected && sorted.length > 1) {
      // Walk from second loan to primary, building refi chain
      for (const loan of sorted) {
        if (loan === sorted[0]) continue; // skip original
        if (loan.date === primaryLoan.date && loan.amount === primaryLoan.amount) break;
        refinances.push({ date: loan.date, amount: loan.amount });
      }
      // Add the primary itself as the final refi
      refinances.push({ date: primaryLoan.date, amount: primaryLoan.amount });
    }

    // Estimate current balance using amortization
    const originalLoan = sorted[0];
    const estimate = estimateCurrentBalance(
      originalLoan.amount,
      originalLoan.date,
      refinances.length > 0 ? refinances : undefined,
    );

    onExtracted({
      loanPayoff: estimate.estimatedBalance,
      loanAmount: primaryLoan.amount,
      interestRate: primaryLoan.assumedRate ?? 0.0665,
      refiDetected,
      secondLienAmount,
      loanOriginationHistory: annotatedLoans,
    });

    setApplied(true);
    setError(null);
  };

  /** Handle rate edit in extraction preview (before Apply) */
  const handlePreviewRateEdit = (index: number, newRatePct: number) => {
    if (!extraction) return;
    // Convert percentage to decimal (e.g. 5.10 -> 0.051)
    const newRate = newRatePct / 100;
    const updatedHistory = extraction.loanOriginationHistory.map(
      (l: LoanOrigination, i: number) =>
        i === index ? { ...l, assumedRate: newRate } : l
    );
    // Update extraction so annotatedLoans re-derives via useMemo
    setExtraction({ ...extraction, loanOriginationHistory: updatedHistory });
  };

  /** Toggle HELOC checkbox for a given loan index */
  const toggleHeloc = (index: number) => {
    setHelocChecked((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  /** Set a loan as primary and uncheck its HELOC flag */
  const setPrimary = (index: number) => {
    setSelectedPrimaryIdx(index);
    setHelocChecked((prev) => {
      const next = [...prev];
      next[index] = false; // primary cannot also be HELOC
      return next;
    });
  };

  /** Format assumed rate for display */
  const fmtRate = (loan: LoanOrigination) =>
    loan.assumedRate != null ? (loan.assumedRate * 100).toFixed(2) : "N/A";

  return (
    <div className="mt-4">
      <p className="text-sm font-medium text-slate mb-2">
        Tax Records <span className="text-xs font-normal text-slate-light">(optional)</span>
      </p>

      {!extraction && (
        <label className="flex h-16 w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-sand hover:border-terra/40 hover:bg-terra/5 transition-colors">
          {extracting ? (
            <span className="text-sm text-slate-light">
              Extracting tax record data...
            </span>
          ) : (
            <span className="flex items-center gap-2 text-sm text-slate-light">
              <Upload className="w-4 h-4" />
              Upload Monsoon tax record PDF
            </span>
          )}
          <input
            type="file"
            accept="application/pdf"
            disabled={extracting}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }}
            className="hidden"
          />
        </label>
      )}

      {error && (
        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800">{error}</p>
        </div>
      )}

      {extraction && (
        <div className={`rounded-lg border p-4 space-y-3 ${applied ? "border-sage/30 bg-sage/5" : "border-sand bg-white"}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate">
              Extracted from Monsoon:
            </p>
            {applied && (
              <span className="flex items-center gap-1 text-xs font-medium text-sage">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Applied
              </span>
            )}
          </div>

          <div className="text-sm text-slate/80 space-y-1">
            <p>
              <span className="font-medium">Address:</span>{" "}
              {extraction.address}, {extraction.city}, {extraction.state}{" "}
              {extraction.zip}
            </p>
            <p>
              <span className="font-medium">Living Area:</span>{" "}
              {extraction.livingArea.toLocaleString()} sqft | Year Built:{" "}
              {extraction.yearBuilt}
            </p>
            {extraction.deedHistory[0] && (
              <p>
                <span className="font-medium">Purchase:</span> $
                {extraction.deedHistory[0].salePrice.toLocaleString()} on{" "}
                {extraction.deedHistory[0].saleDate}
              </p>
            )}
          </div>

          {annotatedLoans.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate">
                Loan History: {annotatedLoans.length} records
              </p>
              <div className="space-y-1.5">
                {annotatedLoans.map((loan, i) => {
                  const isPrimary = selectedPrimaryIdx === i;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${
                        isPrimary ? "bg-terra/5 border border-terra/20" : "bg-white"
                      }`}
                    >
                      {/* Loan info */}
                      <span className="text-xs text-slate/70 flex items-center gap-1 flex-1 min-w-0">
                        <FileText className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">
                          {loan.date}: ${loan.amount.toLocaleString()} @
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={fmtRate(loan)}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) handlePreviewRateEdit(i, val);
                          }}
                          className="w-16 text-xs text-center border-b border-sand bg-transparent focus:outline-none focus:border-terra"
                          title="Edit assumed interest rate (%)"
                          disabled={applied}
                        />
                        <span className="truncate">% ({loan.lender})</span>
                      </span>

                      {/* Controls (only before Apply) */}
                      {!applied && (
                        <span className="flex items-center gap-2 shrink-0">
                          {isPrimary ? (
                            <span className="text-xs font-medium text-terra bg-terra/10 rounded px-2 py-0.5">
                              Primary
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setPrimary(i)}
                                className="text-xs text-terra hover:text-terra-dark underline cursor-pointer"
                              >
                                Set as Primary
                              </button>
                              <label className="flex items-center gap-1 text-xs text-slate/60 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={helocChecked[i] || false}
                                  onChange={() => toggleHeloc(i)}
                                  className="w-3 h-3"
                                />
                                HELOC
                              </label>
                            </>
                          )}
                        </span>
                      )}

                      {/* After apply, show static badges */}
                      {applied && isPrimary && (
                        <span className="text-xs font-medium text-terra bg-terra/10 rounded px-2 py-0.5 shrink-0">
                          Primary
                        </span>
                      )}
                      {applied && !isPrimary && helocChecked[i] && (
                        <span className="text-xs font-medium text-amber-700 bg-amber-100 rounded px-2 py-0.5 shrink-0">
                          HELOC
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {annotatedLoans.length === 0 && (
            <p className="text-sm text-slate/60">No loan origination records found.</p>
          )}

          {!applied && (
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleApply}
                disabled={selectedPrimaryIdx === null}
                className="rounded-lg bg-terra px-4 py-2 text-sm font-semibold text-white hover:bg-terra-dark transition-colors disabled:opacity-50"
              >
                Apply Data
              </button>
              <button
                type="button"
                onClick={() => {
                  setExtraction(null);
                  setApplied(false);
                  setError(null);
                  setSelectedPrimaryIdx(null);
                  setHelocChecked([]);
                }}
                className="rounded-lg border border-sand px-4 py-2 text-sm text-slate hover:bg-sand-pale transition-colors"
              >
                Discard
              </button>
            </div>
          )}

          {applied && (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setApplied(false)}
                className="text-xs text-terra hover:text-terra-dark underline"
              >
                Edit loan selections
              </button>
              <button
                type="button"
                onClick={() => {
                  setExtraction(null);
                  setApplied(false);
                  setSelectedPrimaryIdx(null);
                  setHelocChecked([]);
                }}
                className="text-xs text-slate-light hover:text-slate underline"
              >
                Upload a different tax record
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
