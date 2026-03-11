"use client";

import { useState, useCallback, useRef } from "react";
import type { GenerationStepName, CompSale } from "@/lib/types";

export interface LoanData {
  purchasePrice: number;
  purchaseDate: string;
  loanBalance: number;
  originalLoanAmount: number;
  loanDate: string;
  refinances: { date: string; amount: number }[];
}

interface GenerationState {
  step: GenerationStepName | "idle";
  message: string;
  progress: number;
  html: string | null;
  error: string | null;
  warnings: string[];
  templateType: string;
  isEditing: boolean;
  editError: string | null;
  reviewComps: CompSale[] | null;
  csvResultCache: Record<string, unknown> | null;
  mlsDataCache: Record<string, unknown> | null;
  loanDataCache: LoanData | null;
}

const STEP_LABELS: Record<string, string> = {
  parsing_csv: "Analyzing comparable sales from ARMLS data...",
  extracting_mls: "Extracting property details from MLS listing...",
  review_comps: "Review comparable sales...",
  reading_cromford: "Reading market trends from Cromford screenshots...",
  reading_tax_records: "Extracting purchase price & loan data from tax records...",
  researching: "Researching nearby developments & neighborhood news...",
  generating_content: "Writing market outlook, upgrades & homeowner resources...",
  assembling: "Injecting data into dashboard template...",
  complete: "Dashboard ready!",
  error: "Generation failed",
};

const INITIAL_STATE: GenerationState = {
  step: "idle",
  message: "",
  progress: 0,
  html: null,
  error: null,
  warnings: [],
  templateType: "houseversary",
  isEditing: false,
  editError: null,
  reviewComps: null,
  csvResultCache: null,
  mlsDataCache: null,
  loanDataCache: null,
};

export function useGenerateDashboard() {
  const [state, setState] = useState<GenerationState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const editAbortRef = useRef<AbortController | null>(null);
  const formDataRef = useRef<FormData | null>(null);

  const consumeSSEStream = useCallback(async (res: Response) => {
    const reader = res.body?.getReader();
    if (!reader) {
      setState((s) => ({ ...s, step: "error", error: "No response body", message: "Generation failed" }));
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.step === "complete" && data.html) {
                setState((s) => ({
                  ...s,
                  step: "complete",
                  message: "Dashboard ready!",
                  progress: 100,
                  html: data.html,
                  error: null,
                  templateType: data.templateType || s.templateType,
                }));
              } else if (data.step === "review_comps") {
                setState((s) => ({
                  ...s,
                  step: "review_comps",
                  message: "Review comparable sales",
                  progress: 36,
                  reviewComps: data.comps,
                  csvResultCache: data.csvResult,
                  mlsDataCache: data.mlsData,
                  loanDataCache: data.loanData || null,
                }));
              } else if (data.step === "warning") {
                setState((s) => ({
                  ...s,
                  warnings: [...s.warnings, data.message],
                  message: data.message,
                  progress: data.progress || s.progress,
                }));
              } else if (data.step === "error") {
                setState((s) => ({
                  ...s,
                  step: "error",
                  error: data.message || "Unknown error",
                  message: "Generation failed",
                }));
              } else {
                setState((s) => ({
                  ...s,
                  step: data.step,
                  message: STEP_LABELS[data.step] || data.message || "",
                  progress: data.progress || s.progress,
                }));
              }
            } catch {
              // Ignore parse errors for partial lines
            }
          }
        }
      }

      // Flush any remaining data in the buffer (last chunk may not end with \n)
      if (buffer.trim().startsWith("data: ")) {
        try {
          const data = JSON.parse(buffer.trim().slice(6));

          if (data.step === "complete" && data.html) {
            setState((s) => ({
              ...s,
              step: "complete",
              message: "Dashboard ready!",
              progress: 100,
              html: data.html,
              error: null,
              templateType: data.templateType || s.templateType,
            }));
          } else if (data.step === "review_comps") {
            setState((s) => ({
              ...s,
              step: "review_comps",
              message: "Review comparable sales",
              progress: 36,
              reviewComps: data.comps,
              csvResultCache: data.csvResult,
              mlsDataCache: data.mlsData,
              loanDataCache: data.loanData || null,
            }));
          } else if (data.step === "error") {
            setState((s) => ({
              ...s,
              step: "error",
              error: data.message || "Unknown error",
              message: "Generation failed",
            }));
          }
        } catch {
          // Ignore parse errors for partial data
        }
      }
    } finally {
      reader.cancel().catch(() => {});
    }
  }, []);

  const generate = useCallback(async (formData: FormData) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Store formData for Phase 2
    formDataRef.current = formData;

    const formTemplateType = formData.get("templateType") as string || "houseversary";

    setState({ ...INITIAL_STATE, step: "parsing_csv", message: "Starting...", templateType: formTemplateType });

    try {
      const res = await fetch("/api/dashboard/generate", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        setState((s) => ({ ...s, step: "error", error: errText, message: "Generation failed" }));
        return;
      }

      await consumeSSEStream(res);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState((s) => ({
        ...s,
        step: "error",
        error: (err as Error).message,
        message: "Generation failed",
      }));
    }
  }, [consumeSSEStream]);

  const continueWithComps = useCallback(async (approvedComps: CompSale[], loanOverride?: { originalLoanAmount: number; loanBalance?: number }) => {
    const originalFormData = formDataRef.current;
    if (!originalFormData) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Build Phase 2 FormData
    const fd = new FormData();
    fd.append("templateType", originalFormData.get("templateType") as string);
    fd.append("clientDetails", originalFormData.get("clientDetails") as string);
    fd.append("approvedComps", JSON.stringify(approvedComps));

    // Pass user-verified loan data so Phase 2 can re-run amortization
    if (loanOverride) {
      fd.append("verifiedOriginalLoan", String(loanOverride.originalLoanAmount));
      if (loanOverride.loanBalance !== undefined) {
        fd.append("verifiedLoanBalance", String(loanOverride.loanBalance));
      }
    }

    // Use cached csvResult and mlsData from Phase 1
    setState((s) => {
      if (s.csvResultCache) fd.append("csvResult", JSON.stringify(s.csvResultCache));
      if (s.mlsDataCache) fd.append("mlsData", JSON.stringify(s.mlsDataCache));
      // Pass Phase 1-extracted purchase data so Phase 2 doesn't lose it
      if (s.loanDataCache?.purchasePrice) {
        fd.append("extractedPurchasePrice", String(s.loanDataCache.purchasePrice));
      }
      if (s.loanDataCache?.purchaseDate) {
        fd.append("extractedPurchaseDate", s.loanDataCache.purchaseDate);
      }
      return { ...s, step: "reading_cromford", message: STEP_LABELS.reading_cromford, reviewComps: null, loanDataCache: null };
    });

    // Re-attach file blobs from original FormData (cromford only — tax records already extracted in Phase 1)
    for (const [key, value] of originalFormData.entries()) {
      if (key === "cromford" && value instanceof File) {
        fd.append("cromford", value);
      }
    }

    try {
      const res = await fetch("/api/dashboard/generate/continue", {
        method: "POST",
        body: fd,
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        setState((s) => ({ ...s, step: "error", error: errText, message: "Generation failed" }));
        return;
      }

      await consumeSSEStream(res);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState((s) => ({
        ...s,
        step: "error",
        error: (err as Error).message,
        message: "Generation failed",
      }));
    }
  }, [consumeSSEStream]);

  const applyEdit = useCallback(async (instruction: string): Promise<boolean> => {
    if (!state.html) return false;
    editAbortRef.current?.abort();
    const controller = new AbortController();
    editAbortRef.current = controller;
    setState((s) => ({ ...s, isEditing: true, editError: null }));
    try {
      const res = await fetch("/api/dashboard/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: state.html,
          instruction,
          templateType: state.templateType,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Edit failed" }));
        throw new Error(errBody.error || "Edit failed");
      }
      const { html } = await res.json();
      setState((s) => ({ ...s, html, isEditing: false }));
      return true;
    } catch (err) {
      if ((err as Error).name === "AbortError") return false;
      setState((s) => ({ ...s, isEditing: false, editError: (err as Error).message }));
      return false;
    }
  }, [state.html, state.templateType]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(INITIAL_STATE);
  }, []);

  return { ...state, generate, cancel, reset, applyEdit, continueWithComps };
}
