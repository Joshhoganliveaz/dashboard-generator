"use client";

import type { DashboardType, DashboardStatus } from "@/lib/supabase/types";

const TYPE_OPTIONS: { value: DashboardType | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "sell", label: "Sell" },
  { value: "buyer", label: "Buyer" },
  { value: "buysell", label: "Buy/Sell" },
];

const STATUS_OPTIONS: { value: DashboardStatus | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

interface LibraryFiltersProps {
  typeFilter: DashboardType | null;
  statusFilter: DashboardStatus | null;
  onTypeChange: (type: DashboardType | null) => void;
  onStatusChange: (status: DashboardStatus | null) => void;
}

export default function LibraryFilters({
  typeFilter,
  statusFilter,
  onTypeChange,
  onStatusChange,
}: LibraryFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-light">Type:</span>
        <div className="flex gap-1">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => onTypeChange(opt.value)}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                typeFilter === opt.value
                  ? "bg-terra text-white"
                  : "bg-sand-pale text-slate hover:bg-sand-light"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-light">Status:</span>
        <div className="flex gap-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => onStatusChange(opt.value)}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === opt.value
                  ? "bg-terra text-white"
                  : "bg-sand-pale text-slate hover:bg-sand-light"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
