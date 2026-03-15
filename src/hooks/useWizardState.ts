"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DashboardWithData } from "@/lib/supabase/types";

export interface WizardState {
  dashboard: DashboardWithData | null;
  currentStep: number;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const TOTAL_STEPS = 6;

export function useWizardState(dashboardId: string) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dashboard, setDashboard] = useState<DashboardWithData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize step from URL param or default to 2 (type already selected)
  const stepParam = searchParams.get("step");
  const initialStep = stepParam ? Math.max(1, Math.min(TOTAL_STEPS, parseInt(stepParam, 10) || 2)) : 2;
  const [currentStep, setCurrentStep] = useState(initialStep);

  // Track if we've loaded data to avoid re-fetches
  const loadedRef = useRef(false);

  // Load dashboard data on mount
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/dashboard/${dashboardId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("Dashboard not found");
            return;
          }
          const data = await res.json();
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        const data: DashboardWithData = await res.json();
        setDashboard(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [dashboardId]);

  // Save dashboard-level fields via PATCH
  const saveDashboardFields = useCallback(
    async (updates: Partial<DashboardWithData>) => {
      const dashboardFields: Record<string, unknown> = {};
      const fieldMap = ["client_names", "full_name", "email", "agent_key", "slug", "status"] as const;

      for (const field of fieldMap) {
        if (field in updates) {
          dashboardFields[field] = updates[field as keyof typeof updates];
        }
      }

      if (Object.keys(dashboardFields).length > 0) {
        const res = await fetch(`/api/dashboard/${dashboardId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dashboardFields),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to save dashboard");
        }
      }
    },
    [dashboardId]
  );

  // Navigate to a step, optionally saving data first
  const goToStep = useCallback(
    async (step: number, data?: Partial<DashboardWithData>) => {
      if (step < 1 || step > TOTAL_STEPS) return;
      if (saving) return;

      try {
        setSaving(true);
        setError(null);

        // Save data if provided
        if (data && Object.keys(data).length > 0) {
          await saveDashboardFields(data);

          // Merge saved data into local state
          setDashboard((prev) => {
            if (!prev) return prev;
            return { ...prev, ...data };
          });
        }

        setCurrentStep(step);
        router.push(`/dashboard/${dashboardId}/wizard?step=${step}`, {
          scroll: false,
        });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [dashboardId, saving, saveDashboardFields, router]
  );

  // Update local state without navigating (for in-step field changes)
  const updateDashboardData = useCallback(
    (updates: Partial<DashboardWithData>) => {
      setDashboard((prev) => {
        if (!prev) return prev;
        return { ...prev, ...updates };
      });
    },
    []
  );

  return {
    dashboard,
    currentStep,
    totalSteps: TOTAL_STEPS,
    loading,
    saving,
    error,
    goToStep,
    updateDashboardData,
  };
}
