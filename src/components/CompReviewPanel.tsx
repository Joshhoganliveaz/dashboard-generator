"use client";

import { useState, useMemo } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { CompSale } from "@/lib/types";

interface CompReviewPanelProps {
  comps: CompSale[];
  subjectSqft: number;
  onContinue: (approvedComps: CompSale[]) => void;
  onCancel: () => void;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export default function CompReviewPanel({ comps, subjectSqft, onContinue, onCancel }: CompReviewPanelProps) {
  const [selected, setSelected] = useState<Set<string>>(() => {
    return new Set(comps.map((c) => `${c.addr}|${c.close}`));
  });

  const groupMedianPpsf = useMemo(() => median(comps.map((c) => c.ppsf)), [comps]);

  const selectedComps = useMemo(() => {
    return comps.filter((c) => selected.has(`${c.addr}|${c.close}`));
  }, [comps, selected]);

  const selectedMedianPpsf = useMemo(() => median(selectedComps.map((c) => c.ppsf)), [selectedComps]);
  const estimatedValue = useMemo(() => Math.round(selectedMedianPpsf * subjectSqft), [selectedMedianPpsf, subjectSqft]);

  function toggleComp(comp: CompSale) {
    const key = `${comp.addr}|${comp.close}`;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function getOutlierPct(ppsf: number): number {
    if (groupMedianPpsf === 0) return 0;
    return ((ppsf - groupMedianPpsf) / groupMedianPpsf) * 100;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
      <div className="mb-5">
        <h2 className="text-lg font-display font-bold text-slate">Review Comparable Sales</h2>
        <p className="text-sm text-slate-light mt-1">Uncheck any comps you want to exclude from the analysis</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {comps.map((comp) => {
          const key = `${comp.addr}|${comp.close}`;
          const isSelected = selected.has(key);
          const outlierPct = getOutlierPct(comp.ppsf);
          const isOutlier = Math.abs(outlierPct) > 15;

          return (
            <button
              key={key}
              onClick={() => toggleComp(comp)}
              className={`text-left p-4 rounded-lg border-2 transition-all ${
                isSelected
                  ? isOutlier
                    ? "border-amber-400 bg-amber-50/30"
                    : "border-sage bg-sage/5"
                  : "border-sand-pale bg-sand-pale/20 opacity-50"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate text-sm truncate">{comp.addr}</p>
                  <p className="text-xs text-slate-light truncate">{comp.sub}</p>
                </div>
                <div className="flex-shrink-0">
                  {isSelected ? (
                    <CheckCircle2 className="w-5 h-5 text-sage" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-sand" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div>
                  <span className="text-slate-light">Sold: </span>
                  <span className="text-slate font-medium">${comp.sp.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-light">$/SF: </span>
                  <span className="text-slate font-medium">${comp.ppsf.toFixed(0)}</span>
                </div>
                <div>
                  <span className="text-slate-light">SF: </span>
                  <span className="text-slate font-medium">{comp.sf.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-light">Close: </span>
                  <span className="text-slate font-medium">{comp.close}</span>
                </div>
                <div>
                  <span className="text-slate-light">Bed/Bath: </span>
                  <span className="text-slate font-medium">{comp.beds}/{comp.baths}</span>
                </div>
                <div>
                  <span className="text-slate-light">Pool: </span>
                  <span className="text-slate font-medium">{comp.pool}</span>
                </div>
                <div>
                  <span className="text-slate-light">DOM: </span>
                  <span className="text-slate font-medium">{comp.dom}</span>
                </div>
                <div>
                  <span className="text-slate-light">Score: </span>
                  <span className="text-slate font-medium">{comp.matchScore}</span>
                </div>
              </div>

              {isOutlier && (
                <div className="flex items-center gap-1.5 mt-2 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-amber-700 font-medium">
                    $/SF {outlierPct > 0 ? `${Math.round(outlierPct)}% above` : `${Math.round(Math.abs(outlierPct))}% below`} median
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-5 flex items-center justify-between border-t border-sand-pale pt-4">
        <div className="text-sm text-slate">
          <span className="font-semibold">{selectedComps.length}</span> of {comps.length} comps selected
          {selectedComps.length >= 2 && subjectSqft > 0 && (
            <span className="text-slate-light ml-3">
              Est. value: <span className="font-semibold text-slate">${estimatedValue.toLocaleString()}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate hover:text-slate/70 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onContinue(selectedComps)}
            disabled={selectedComps.length < 2}
            className="bg-terra text-white px-5 py-2 rounded-lg font-semibold text-sm hover:bg-terra-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue with {selectedComps.length} Comp{selectedComps.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
      {selectedComps.length < 2 && (
        <p className="text-xs text-amber-600 text-right mt-1">Select at least 2 comps to continue</p>
      )}
    </div>
  );
}
