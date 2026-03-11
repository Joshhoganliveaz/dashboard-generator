"use client";

import { useState, useMemo } from "react";
import { Search, Loader2, CheckCircle2, X, ChevronDown, ChevronUp } from "lucide-react";
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
  const currentMonth = new Date().getMonth() + 1;
  const [activeMonth, setActiveMonth] = useState(currentMonth);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filtered = useMemo(
    () => searchClients(query, activeMonth),
    [searchClients, query, activeMonth]
  );

  if (loading) {
    return (
      <div className="glass-card rounded-lg p-5 flex items-center gap-3 text-light-muted">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading clients...
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card rounded-lg p-5 text-sm text-error">
        Failed to load clients: {error}
      </div>
    );
  }

  return (
    <div className="glass-card rounded-lg p-5">
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between"
      >
        <h2 className="text-sm font-semibold text-light tracking-tight">Houseversary Client List</h2>
        <div className="flex items-center gap-2">
          {selectedAddress && (
            <span
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="text-xs text-light-dim hover:text-accent flex items-center gap-1 transition-colors"
            >
              <X className="w-3 h-3" />
              Clear
            </span>
          )}
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-light-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-light-muted" />
          )}
        </div>
      </button>

      {isOpen && <>
      {/* Month filter bar */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {MONTHS.map((label, i) => {
          const month = i + 1;
          const count = monthCounts[month] || 0;
          const isActive = month === activeMonth;
          return (
            <button
              key={month}
              onClick={() => setActiveMonth(month)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? "bg-accent text-dark"
                  : "bg-dark-elevated text-light-muted hover:text-light"
              }`}
            >
              {label}
              {count > 0 && (
                <span
                  className={`ml-1 text-[10px] font-bold ${
                    isActive ? "text-dark/70" : "text-accent"
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light-dim" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or address..."
          className="w-full pl-9 pr-3 py-2 bg-dark-elevated border border-transparent rounded-md text-sm text-light placeholder:text-light-dim focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20"
        />
      </div>

      {/* Client list */}
      <div className="max-h-64 overflow-y-auto space-y-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-light-dim py-4 text-center">
            No clients with closings in {MONTHS[activeMonth - 1]}
          </p>
        ) : (
          filtered.map((client) => {
            const isSelected = selectedAddress === client.address;
            return (
              <button
                key={`${client.address}-${client.fullName}`}
                onClick={() => onSelect(client)}
                className={`w-full text-left px-3 py-2.5 rounded-md transition-colors flex items-center gap-3 ${
                  isSelected
                    ? "bg-accent-muted border border-accent/20"
                    : "hover:bg-dark-elevated border border-transparent"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-light truncate">
                      {client.clientNames}
                    </span>
                    {client.dashboardUrl && (
                      <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-md font-bold flex-shrink-0">
                        Done
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-light-dim truncate">
                    {client.address} · {client.cityStateZip}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-light-muted">{client.yearsOwned}yr</div>
                  <div className="text-[10px] text-light-dim">{client.tenureTag}</div>
                </div>
                {isSelected && (
                  <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                )}
              </button>
            );
          })
        )}
      </div>

      <div className="mt-3 text-[10px] text-light-dim text-center">
        {clients.length} total · {filtered.length} shown
      </div>
      </>}
    </div>
  );
}
