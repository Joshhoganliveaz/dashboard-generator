"use client";

import { useState, useMemo } from "react";
import { Search, Loader2, CheckCircle2, X } from "lucide-react";
import { useClients, type ClientRecord } from "@/hooks/useClients";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface ClientPickerProps {
  onSelect: (client: ClientRecord) => void;
  onClear: () => void;
  selectedAddress: string | null;
}

export default function ClientPicker({ onSelect, onClear, selectedAddress }: ClientPickerProps) {
  const { clients, loading, error, searchClients, monthCounts } = useClients();
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const [activeMonth, setActiveMonth] = useState(currentMonth);
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => searchClients(query, activeMonth),
    [searchClients, query, activeMonth]
  );

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-3 text-slate-light">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading clients...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 text-sm text-red-600">
        Failed to load clients: {error}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-display font-bold text-slate">Client Picker</h2>
        {selectedAddress && (
          <button
            onClick={onClear}
            className="text-xs text-slate-light hover:text-terra flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" />
            Clear Selection
          </button>
        )}
      </div>

      {/* Month filter bar */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {MONTHS.map((label, i) => {
          const month = i + 1;
          const count = monthCounts[month] || 0;
          const isActive = month === activeMonth;
          return (
            <button
              key={month}
              onClick={() => setActiveMonth(month)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors relative ${
                isActive
                  ? "bg-terra text-white"
                  : "bg-sand-pale text-slate hover:bg-sand-light"
              }`}
            >
              {label}
              {count > 0 && (
                <span
                  className={`ml-1 text-[10px] font-bold ${
                    isActive ? "text-white/80" : "text-terra"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-light" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or address..."
          className="w-full pl-9 pr-3 py-2 border border-sand-pale rounded-lg text-sm text-slate focus:outline-none focus:border-terra"
        />
      </div>

      {/* Client list */}
      <div className="max-h-64 overflow-y-auto space-y-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-light py-4 text-center">
            No clients with closings in {MONTHS[activeMonth - 1]}
          </p>
        ) : (
          filtered.map((client) => {
            const isSelected = selectedAddress === client.address;
            return (
              <button
                key={`${client.address}-${client.fullName}`}
                onClick={() => onSelect(client)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-3 ${
                  isSelected
                    ? "bg-sage/10 border border-sage/30"
                    : "hover:bg-sand-pale border border-transparent"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate truncate">
                      {client.clientNames}
                    </span>
                    {client.dashboardUrl && (
                      <span className="text-[10px] bg-sage/20 text-sage-dark px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                        Done
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-light truncate">
                    {client.address} · {client.cityStateZip}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-slate-light">{client.yearsOwned}yr</div>
                  <div className="text-[10px] text-slate-light/70">{client.tenureTag}</div>
                </div>
                {isSelected && (
                  <CheckCircle2 className="w-4 h-4 text-sage flex-shrink-0" />
                )}
              </button>
            );
          })
        )}
      </div>

      <div className="mt-3 text-[10px] text-slate-light text-center">
        {clients.length} total clients · {filtered.length} shown
      </div>
    </div>
  );
}
