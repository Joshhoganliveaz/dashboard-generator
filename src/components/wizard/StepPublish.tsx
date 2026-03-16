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
  Copy,
  Check,
  Download,
  Globe,
  Archive,
  ExternalLink,
} from "lucide-react";
import type { DashboardWithData, DashboardStatus } from "@/lib/supabase/types";

interface StepPublishProps {
  dashboard: DashboardWithData;
  goToStep: (step: number, data?: Partial<DashboardWithData>) => Promise<void>;
  saving: boolean;
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const STATUS_CONFIG: Record<DashboardStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-amber-100 text-amber-700" },
  published: { label: "Published", className: "bg-emerald-100 text-emerald-700" },
  archived: { label: "Archived", className: "bg-slate-100 text-slate-500" },
};

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

  // Publish action state
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(
    dashboard.published_at ? `${typeof window !== "undefined" ? window.location.origin : ""}/d/${dashboard.slug}` : null
  );
  const [copied, setCopied] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Track status locally so UI updates without full refresh
  const [currentStatus, setCurrentStatus] = useState<DashboardStatus>(dashboard.status);

  const isPublished = currentStatus === "published";
  const isArchived = currentStatus === "archived";
  const isDraft = currentStatus === "draft";
  const slugEditable = !dashboard.published_at;

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

  // Publish handler
  const handlePublish = useCallback(async () => {
    setPublishing(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/dashboard/${dashboard.id}/publish`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to publish");
      }
      const data = await res.json();
      const fullUrl = `${window.location.origin}${data.url}`;
      setPublishedUrl(fullUrl);
      setCurrentStatus("published");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setPublishing(false);
    }
  }, [dashboard.id]);

  // Archive handler
  const handleArchive = useCallback(async () => {
    const confirmed = window.confirm(
      "Archive this dashboard? The public URL will return 404."
    );
    if (!confirmed) return;

    setArchiving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/dashboard/${dashboard.id}/archive`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to archive");
      }
      setCurrentStatus("archived");
      setPublishedUrl(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to archive");
    } finally {
      setArchiving(false);
    }
  }, [dashboard.id]);

  // Download handler
  const handleDownload = useCallback(() => {
    window.open(`/api/dashboard/${dashboard.id}/download`, "_blank");
  }, [dashboard.id]);

  // Copy URL handler
  const handleCopyUrl = useCallback(async () => {
    if (!publishedUrl) return;
    try {
      await navigator.clipboard.writeText(publishedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text approach
      setActionError("Could not copy to clipboard");
    }
  }, [publishedUrl]);

  // Publish button label
  const publishLabel = isDraft
    ? "Publish Dashboard"
    : isPublished
      ? "Re-Publish Dashboard"
      : "Un-Archive & Publish";

  // Dashboard type badge
  const typeBadge = {
    sell: { label: "Sell", color: "bg-terra/10 text-terra" },
    buyer: { label: "Buyer", color: "bg-blue-100 text-blue-700" },
    buysell: { label: "Buy / Sell", color: "bg-purple-100 text-purple-700" },
  }[dashboard.type];

  const statusConfig = STATUS_CONFIG[currentStatus];

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
              <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${statusConfig.className}`}>
                {statusConfig.label}
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

      {/* Published URL Banner */}
      {publishedUrl && isPublished && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-emerald-800">Dashboard Published</h3>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-sm text-emerald-700 underline hover:no-underline truncate"
            >
              {publishedUrl}
            </a>
            <button
              onClick={handleCopyUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors flex-shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy URL
                </>
              )}
            </button>
            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-emerald-600 hover:text-emerald-800 transition-colors flex-shrink-0"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Action failed</p>
            <p className="text-sm text-red-600 mt-0.5">{actionError}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="space-y-3">
          {/* Publish / Re-Publish / Un-Archive & Publish */}
          <button
            onClick={handlePublish}
            disabled={publishing || saving}
            className="w-full bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {publishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Globe className="w-4 h-4" />
                {publishLabel}
              </>
            )}
          </button>

          {/* Download HTML */}
          <button
            onClick={handleDownload}
            disabled={saving}
            className="w-full bg-white border border-sand text-slate px-6 py-3 rounded-lg font-semibold text-sm hover:bg-sand-pale transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download HTML
          </button>

          {/* Archive (only for published dashboards) */}
          {isPublished && (
            <button
              onClick={handleArchive}
              disabled={archiving || saving}
              className="w-full bg-white border border-red-200 text-red-600 px-6 py-3 rounded-lg font-semibold text-sm hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {archiving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Archiving...
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4" />
                  Archive Dashboard
                </>
              )}
            </button>
          )}

          {/* Divider */}
          <div className="border-t border-sand my-1" />

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
