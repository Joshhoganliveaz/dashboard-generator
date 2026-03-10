"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { ClientRecord } from "@/app/api/clients/route";

export type { ClientRecord };

export function useClients() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchClients() {
      try {
        const res = await fetch("/api/clients");
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data: ClientRecord[] = await res.json();
        if (!cancelled) {
          setClients(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchClients();
    return () => { cancelled = true; };
  }, []);

  const filterByMonth = useCallback(
    (month: number) => clients.filter((c) => c.closingMonth === month),
    [clients]
  );

  const searchClients = useCallback(
    (query: string, month?: number) => {
      const base = month ? clients.filter((c) => c.closingMonth === month) : clients;
      if (!query.trim()) return base;
      const q = query.toLowerCase();
      return base.filter(
        (c) =>
          c.clientNames.toLowerCase().includes(q) ||
          c.fullName.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q) ||
          c.cityStateZip.toLowerCase().includes(q)
      );
    },
    [clients]
  );

  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) counts[m] = 0;
    for (const c of clients) {
      if (c.closingMonth >= 1 && c.closingMonth <= 12) {
        counts[c.closingMonth]++;
      }
    }
    return counts;
  }, [clients]);

  return { clients, loading, error, filterByMonth, searchClients, monthCounts };
}
