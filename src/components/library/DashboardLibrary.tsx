"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Plus, ChevronUp, ChevronDown, Pencil, Trash2 } from "lucide-react";
import type { Dashboard, DashboardType, DashboardStatus } from "@/lib/supabase/types";
import LibraryFilters from "./LibraryFilters";

// ---- Badge maps (moved from DashboardCard) ----

const TYPE_BADGE: Record<DashboardType, { label: string; className: string }> = {
  sell: { label: "Sell", className: "bg-terra/15 text-terra-dark" },
  buyer: { label: "Buyer", className: "bg-sage/15 text-sage-dark" },
  buysell: { label: "Buy/Sell", className: "bg-sand/15 text-slate" },
};

const STATUS_BADGE: Record<DashboardStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate/10 text-slate-light" },
  published: { label: "Published", className: "bg-sage-dark/15 text-sage-dark" },
  archived: { label: "Archived", className: "bg-sand-pale text-slate-light" },
};

// ---- Helpers ----

function relativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ---- Sort types ----

type SortKey = "client_names" | "slug" | "type" | "status" | "updated_at";
type SortDir = "asc" | "desc";

export function sortDashboards(
  dashboards: Dashboard[],
  sortKey: SortKey,
  sortDir: SortDir
): Dashboard[] {
  return [...dashboards].sort((a, b) => {
    let cmp: number;
    if (sortKey === "updated_at") {
      cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
    } else {
      const aVal = a[sortKey] ?? "";
      const bVal = b[sortKey] ?? "";
      cmp = String(aVal).localeCompare(String(bVal));
    }
    return sortDir === "asc" ? cmp : -cmp;
  });
}

// ---- Columns ----

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "client_names", label: "Client" },
  { key: "slug", label: "Slug" },
  { key: "type", label: "Type" },
  { key: "status", label: "Status" },
  { key: "updated_at", label: "Updated" },
];

// ---- Component ----

interface DashboardLibraryProps {
  dashboards: Dashboard[];
}

export default function DashboardLibrary({ dashboards: initialDashboards }: DashboardLibraryProps) {
  const [dashboards, setDashboards] = useState<Dashboard[]>(initialDashboards);
  const [typeFilter, setTypeFilter] = useState<DashboardType | null>(null);
  const [statusFilter, setStatusFilter] = useState<DashboardStatus | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const result = dashboards.filter((d) => {
      if (typeFilter && d.type !== typeFilter) return false;
      if (statusFilter && d.status !== statusFilter) return false;
      return true;
    });
    return sortDashboards(result, sortKey, sortDir);
  }, [dashboards, typeFilter, statusFilter, sortKey, sortDir]);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const handleDelete = useCallback(async (d: Dashboard) => {
    const confirmed = window.confirm(
      `Delete dashboard for ${d.client_names}? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(d.id);
    try {
      const res = await fetch(`/api/dashboard/${d.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete dashboard");
      }
      setDashboards((prev) => prev.filter((item) => item.id !== d.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete dashboard");
    } finally {
      setDeletingId(null);
    }
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <LibraryFilters
          typeFilter={typeFilter}
          statusFilter={statusFilter}
          onTypeChange={setTypeFilter}
          onStatusChange={setStatusFilter}
        />
        <Link
          href="/dashboard/new"
          className="flex items-center gap-2 bg-terra text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-terra-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Dashboard
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-light text-lg">No dashboards found</p>
          {(typeFilter || statusFilter) && (
            <button
              onClick={() => {
                setTypeFilter(null);
                setStatusFilter(null);
              }}
              className="text-terra hover:underline mt-2 text-sm"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-sand-pale overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-sand-pale/50 text-left text-sm font-medium text-slate-light">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-3 cursor-pointer select-none hover:text-slate transition-colors"
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && (
                        sortDir === "asc" ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )
                      )}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const typeBadge = TYPE_BADGE[d.type];
                const statusBadge = STATUS_BADGE[d.status];
                const isDeleting = deletingId === d.id;

                return (
                  <tr
                    key={d.id}
                    className="border-t border-sand-pale hover:bg-cream/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-display font-semibold text-slate">
                      {d.client_names}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-light max-w-[200px] truncate">
                      {d.slug}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${typeBadge.className}`}
                      >
                        {typeBadge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadge.className}`}
                      >
                        {statusBadge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-light">
                      {relativeDate(d.updated_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/dashboard/${d.id}/wizard`}
                          className="p-1.5 rounded-md text-slate-light hover:text-terra hover:bg-terra/10 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(d)}
                          disabled={isDeleting}
                          className="p-1.5 rounded-md text-slate-light hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
