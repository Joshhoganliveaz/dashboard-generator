"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Search, ArrowLeftRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DashboardType } from "@/lib/supabase/types";

const DASHBOARD_TYPES: {
  value: DashboardType;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "sell",
    label: "Sell Dashboard",
    description:
      "Pre-listing CMA with pricing strategy, comparable sales analysis, and net proceeds estimate",
    icon: <TrendingUp className="w-8 h-8" />,
  },
  {
    value: "buyer",
    label: "Buyer Dashboard",
    description:
      "Purchase calculator with neighborhood profiles, school districts, and home search criteria",
    icon: <Search className="w-8 h-8" />,
  },
  {
    value: "buysell",
    label: "Buy / Sell Dashboard",
    description:
      "Combined sell analysis and buyer search with bridge loan calculations",
    icon: <ArrowLeftRight className="w-8 h-8" />,
  },
];

export default function NewDashboardPage() {
  const router = useRouter();
  const [creating, setCreating] = useState<DashboardType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(type: DashboardType) {
    if (creating) return;

    try {
      setCreating(type);
      setError(null);

      const supabase = createClient();
      const { data, error: dbError } = await supabase
        .from("dashboards")
        .insert({
          type,
          client_names: "",
          slug: `draft-${Date.now()}`,
          status: "draft",
        })
        .select()
        .single();

      if (dbError) throw new Error(dbError.message);

      router.push(`/dashboard/${data.id}/wizard?step=2`);
    } catch (err) {
      setError((err as Error).message);
      setCreating(null);
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-slate text-white px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-display font-bold">New Dashboard</h1>
          <p className="text-sm opacity-70">Select a dashboard type to get started</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {DASHBOARD_TYPES.map((dt) => {
            const isCreating = creating === dt.value;
            const isDisabled = creating !== null && !isCreating;

            return (
              <button
                key={dt.value}
                onClick={() => handleSelect(dt.value)}
                disabled={isDisabled}
                className={`text-left p-6 rounded-xl border-2 transition-all bg-white group ${
                  isCreating
                    ? "border-terra bg-terra/5"
                    : isDisabled
                    ? "border-sand-pale opacity-50 cursor-not-allowed"
                    : "border-sand-pale hover:border-terra hover:shadow-md"
                }`}
              >
                <div
                  className={`mb-4 ${
                    isCreating ? "text-terra" : "text-sand group-hover:text-terra"
                  } transition-colors`}
                >
                  {isCreating ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : (
                    dt.icon
                  )}
                </div>
                <h3 className="text-lg font-display font-bold text-slate mb-2">
                  {dt.label}
                </h3>
                <p className="text-sm text-slate-light leading-relaxed">
                  {dt.description}
                </p>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </main>
    </div>
  );
}
