"use client";

import Link from "next/link";
import type { Dashboard, DashboardType, DashboardStatus } from "@/lib/supabase/types";

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

interface DashboardCardProps {
  dashboard: Dashboard;
}

export default function DashboardCard({ dashboard }: DashboardCardProps) {
  const typeBadge = TYPE_BADGE[dashboard.type];
  const statusBadge = STATUS_BADGE[dashboard.status];

  return (
    <Link
      href={`/dashboard/${dashboard.id}/wizard`}
      className="block bg-white rounded-xl shadow-sm border border-sand-pale hover:shadow-md hover:border-sand transition-all p-5"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-display font-bold text-slate text-lg leading-snug">
          {dashboard.client_names}
        </h3>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ml-2 ${statusBadge.className}`}
        >
          {statusBadge.label}
        </span>
      </div>

      <p className="text-sm text-slate-light truncate mb-3">
        {dashboard.slug}
      </p>

      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${typeBadge.className}`}
        >
          {typeBadge.label}
        </span>
        <span className="text-xs text-slate-light">
          Updated {relativeDate(dashboard.updated_at)}
        </span>
      </div>
    </Link>
  );
}
