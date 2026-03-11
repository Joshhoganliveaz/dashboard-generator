"use client";

import { useState, useCallback, useRef } from "react";
import type { GenerationStepName } from "@/lib/types";

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
}

const STEP_LABELS: Record<string, string> = {
  parsing_csv: "Analyzing comparable sales from ARMLS data...",
  extracting_mls: "Extracting property details from MLS listing...",
  reading_cromford: "Reading market trends from Cromford screenshots...",
  reading_tax_records: "Extracting purchase price & loan data from tax records...",
  researching: "Researching nearby developments & neighborhood news...",
  generating_content: "Writing market outlook, upgrades & homeowner resources...",
  assembling: "Injecting data into dashboard template...",
  complete: "Dashboard ready!",
  error: "Generation failed",
};

export function useGenerateDashboard() {
  const [state, setState] = useState<GenerationState>({
    step: "idle",
    message: "",
    progress: 0,
    html: null,
    error: null,
    warnings: [],
    templateType: "houseversary",
    isEditing: false,
    editError: null,
  });
  const abortRef = useRef<AbortController | null>(null);
  const editAbortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (formData: FormData) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const formTemplateType = formData.get("templateType") as string || "houseversary";

    setState({ step: "parsing_csv", message: "Starting...", progress: 0, html: null, error: null, warnings: [], templateType: formTemplateType, isEditing: false, editError: null });

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
      } finally {
        reader.cancel().catch(() => {});
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState((s) => ({
        ...s,
        step: "error",
        error: (err as Error).message,
        message: "Generation failed",
      }));
    }
  }, []);

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
    setState({ step: "idle", message: "", progress: 0, html: null, error: null, warnings: [], templateType: "houseversary", isEditing: false, editError: null });
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ step: "idle", message: "", progress: 0, html: null, error: null, warnings: [], templateType: "houseversary", isEditing: false, editError: null });
  }, []);

  return { ...state, generate, cancel, reset, applyEdit };
}
