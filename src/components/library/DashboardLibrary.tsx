"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { Dashboard, DashboardType, DashboardStatus } from "@/lib/supabase/types";
import DashboardCard from "./DashboardCard";
import LibraryFilters from "./LibraryFilters";

interface DashboardLibraryProps {
  dashboards: Dashboard[];
}

export default function DashboardLibrary({ dashboards }: DashboardLibraryProps) {
  const [typeFilter, setTypeFilter] = useState<DashboardType | null>(null);
  const [statusFilter, setStatusFilter] = useState<DashboardStatus | null>(null);

  const filtered = useMemo(() => {
    return dashboards.filter((d) => {
      if (typeFilter && d.type !== typeFilter) return false;
      if (statusFilter && d.status !== statusFilter) return false;
      return true;
    });
  }, [dashboards, typeFilter, statusFilter]);

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((d) => (
            <DashboardCard key={d.id} dashboard={d} />
          ))}
        </div>
      )}
    </div>
  );
}
