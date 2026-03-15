"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Save,
  Calendar,
  User,
  MapPin,
  Tag,
  Link as LinkIcon,
} from "lucide-react";
import type { DashboardWithData } from "@/lib/supabase/types";

interface StepPublishProps {
  dashboard: DashboardWithData;
  goToStep: (step: number, data?: Partial<DashboardWithData>) => Promise<void>;
  saving: boolean;
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default function StepPublish({
  dashboard,
  goToStep,
  saving,
}: StepPublishProps) {
  const router = useRouter();
  const [slug, setSlug] = useState(dashboard.slug);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [slugSuggestion, setSlugSuggestion] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [savingSlug, setSavingSlug] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isPublished = !!dashboard.published_at;
  const slugEditable = !isPublished;

  // Debounced slug availability check
  useEffect(() => {
    if (!slugEditable) return;
    if (slug === dashboard.slug) {
      setSlugStatus("idle");
      setSlugSuggestion(null);
      setSlugError(null);
      return;
    }

    // Validate format
    if (!slug || !SLUG_REGEX.test(slug)) {
      setSlugStatus("idle");
      setSlugError(slug ? "Slug must be lowercase letters, numbers, and hyphens only" : null);
      return;
    }

    setSlugError(null);
    setSlugStatus("checking");

    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    checkTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/slug/check?slug=${encodeURIComponent(slug)}&excludeId=${dashboard.id}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.available) {
            setSlugStatus("available");
            setSlugSuggestion(null);
          } else {
            setSlugStatus("taken");
            setSlugSuggestion(data.suggestion || null);
          }
        }
      } catch {
        setSlugStatus("idle");
      }
    }, 500);

    return () => {
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    };
  }, [slug, dashboard.slug, dashboard.id, slugEditable]);

  const handleSaveSlug = useCallback(async () => {
    if (!slugEditable || slug === dashboard.slug) return;
    if (!SLUG_REGEX.test(slug)) return;
    if (slugStatus === "taken") return;

    setSavingSlug(true);
    try {
      await goToStep(6, { slug } as Partial<DashboardWithData>);
    } catch {
      // Error handled by goToStep
    } finally {
      setSavingSlug(false);
    }
  }, [slug, dashboard.slug, slugEditable, slugStatus, goToStep]);

  const handleSaveAndReturn = useCallback(async () => {
    setSaveSuccess(false);
    try {
      // Save slug if changed
      if (slugEditable && slug !== dashboard.slug && SLUG_REGEX.test(slug) && slugStatus !== "taken") {
        await goToStep(6, { slug } as Partial<DashboardWithData>);
      }
      router.push("/");
    } catch {
      // Navigate anyway
      router.push("/");
    }
  }, [slug, dashboard.slug, slugEditable, slugStatus, goToStep, router]);

  // Dashboard type badge
  const typeBadge = {
    sell: { label: "Sell", color: "bg-terra/10 text-terra" },
    buyer: { label: "Buyer", color: "bg-blue-100 text-blue-700" },
    buysell: { label: "Buy / Sell", color: "bg-purple-100 text-purple-700" },
  }[dashboard.type];

  return (
    <div className="space-y-6">
      {/* Review Summary */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-display font-bold text-slate mb-4">
          Review Summary
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Dashboard Type */}
          <div className="flex items-center gap-3">
            <Tag className="w-4 h-4 text-slate-light flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-light">Dashboard Type</p>
              <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${typeBadge.color}`}>
                {typeBadge.label}
              </span>
            </div>
          </div>

          {/* Client Name */}
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-slate-light flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-light">Client</p>
              <p className="text-sm font-medium text-slate">{dashboard.client_names}</p>
            </div>
          </div>

          {/* Address or Target Areas */}
          {dashboard.type !== "buyer" && dashboard.sell_data?.address && (
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-slate-light flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-light">Property Address</p>
                <p className="text-sm font-medium text-slate">
                  {dashboard.sell_data.address}
                  {dashboard.sell_data.city_state_zip && (
                    <span className="text-slate-light font-normal">
                      , {dashboard.sell_data.city_state_zip}
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}
          {dashboard.type === "buyer" && dashboard.buy_data?.target_areas && (
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-slate-light flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-light">Target Areas</p>
                <p className="text-sm font-medium text-slate">{dashboard.buy_data.target_areas}</p>
              </div>
            </div>
          )}

          {/* Agent */}
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-slate-light flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-light">Agent</p>
              <p className="text-sm font-medium text-slate capitalize">{dashboard.agent_key}</p>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-3">
            <Tag className="w-4 h-4 text-slate-light flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-light">Status</p>
              <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                Draft
              </span>
            </div>
          </div>

          {/* Created */}
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-slate-light flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-light">Created</p>
              <p className="text-sm font-medium text-slate">
                {new Date(dashboard.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          {/* Last Updated */}
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-slate-light flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-light">Last Updated</p>
              <p className="text-sm font-medium text-slate">
                {new Date(dashboard.updated_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Slug Editor */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <LinkIcon className="w-4 h-4 text-slate-light" />
          <h3 className="text-lg font-display font-bold text-slate">Dashboard URL</h3>
        </div>

        <div className="mb-2">
          <label className="block text-sm text-slate-light mb-1.5">
            Slug
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <div className="flex items-center border border-sand rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-terra/30 focus-within:border-terra">
                <span className="pl-3 text-sm text-slate-light select-none whitespace-nowrap">
                  /d/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  disabled={!slugEditable}
                  onBlur={handleSaveSlug}
                  className="flex-1 text-sm py-2.5 pr-3 border-0 focus:outline-none focus:ring-0 disabled:bg-sand-pale/30 disabled:cursor-not-allowed"
                  placeholder="client-name-address"
                />
                {!slugEditable && (
                  <Lock className="w-4 h-4 text-slate-light mr-3 flex-shrink-0" />
                )}
              </div>

              {/* Status indicator */}
              {slugStatus === "checking" && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 text-slate-light animate-spin" />
                </div>
              )}
              {slugStatus === "available" && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <CheckCircle2 className="w-4 h-4 text-sage" />
                </div>
              )}
              {slugStatus === "taken" && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                </div>
              )}
            </div>

            {slugEditable && slug !== dashboard.slug && slugStatus === "available" && (
              <button
                onClick={handleSaveSlug}
                disabled={savingSlug}
                className="px-3 py-2.5 bg-terra text-white rounded-lg text-sm font-semibold hover:bg-terra-dark transition-colors disabled:opacity-50"
              >
                {savingSlug ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </button>
            )}
          </div>
        </div>

        {/* Status Messages */}
        {slugError && (
          <p className="text-xs text-red-600 mt-1">{slugError}</p>
        )}
        {slugStatus === "taken" && (
          <div className="text-xs text-red-600 mt-1">
            This slug is already taken.
            {slugSuggestion && (
              <button
                onClick={() => setSlug(slugSuggestion)}
                className="ml-1 text-terra underline hover:no-underline"
              >
                Use &ldquo;{slugSuggestion}&rdquo; instead?
              </button>
            )}
          </div>
        )}
        {!slugEditable && (
          <p className="text-xs text-slate-light mt-1 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Slug is locked after first publish to prevent broken URLs
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="space-y-3">
          {/* Publish Placeholder */}
          <div className="relative group">
            <button
              disabled
              className="w-full bg-slate/20 text-slate-light px-6 py-3 rounded-lg font-semibold text-sm cursor-not-allowed"
              title="Publishing will be available in a future update"
            >
              Publish Dashboard
            </button>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate text-white text-xs px-3 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Publishing will be available in a future update
            </div>
          </div>

          {/* Save & Return */}
          <button
            onClick={handleSaveAndReturn}
            disabled={saving}
            className="w-full bg-terra text-white px-6 py-3 rounded-lg font-semibold text-sm hover:bg-terra-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save &amp; Return to Library
          </button>

          {saveSuccess && (
            <p className="text-xs text-sage text-center">Saved successfully</p>
          )}
        </div>
      </div>

      {/* Back Navigation */}
      <div className="flex items-center">
        <button
          onClick={() => goToStep(5)}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 border border-sand rounded-lg text-slate text-sm font-medium hover:bg-sand-pale transition-colors disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Preview
        </button>
      </div>
    </div>
  );
}
