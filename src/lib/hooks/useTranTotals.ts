"use client";

// Modelled on FinanceClient.tsx's inline fetch pattern, extracted into a
// reusable hook. Uses a module-level cache (same approach as
// src/server/supabase/getUserWithApiConnection.ts) so the dashboard doesn't
// re-fetch on every mount during the same browser session.

import { useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
// Shape of one row from POST /api/trantotals/trantotals (one row per till operator).
export interface TranTotalRow {
  id: number;
  code: string;
  tillDay: string;
  name: string;
  dayTotal: number;
  monthTotal: number;
  yearTotal: number;
  lastYearTotal: number;
  newDayTotal: number;
  newMonthTotal: number;
  newYearTotal: number;
  userInvoices: number;
  userCreditNotes: number;
  userCashSales: number;
  userCashRefunds: number;
  userSettleDisc: number;
  userTradeDisc: number;
  userCashPurch: number;
  userFloat: number;
  userCash: number;
  userCheques: number;
  userCreditCards: number;
  userEFT: number;
  userVouchers: number;
  userOther: number;
  transfer: boolean;
  programVersion: string;
  cashupDone: boolean;
}

export interface UseTranTotalsResult {
  rows: TranTotalRow[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ── Client-side cache ─────────────────────────────────────────────────────────
// Keyed by companyNr — prevents leaking one tenant's cached rows to another.
interface CacheEntry {
  rows: TranTotalRow[];
  fetchedAt: number;
}
const clientCache = new Map<string, CacheEntry>();
const STALE_MS = 5 * 60 * 1000; // 5 minutes, matching the server-side cache TTL

// In-flight requests, so a prefetch and a mounting dashboard share one fetch.
type LoadResult = { rows: TranTotalRow[] } | { error: string };
const pendingFetches = new Map<string, Promise<LoadResult>>();

// ── Shared loader ─────────────────────────────────────────────────────────────
// Used by both the hook and prefetchTranTotals. Serves fresh cache, joins an
// in-flight request, or fetches and populates the cache.
function loadTranTotals(companyNr: string): Promise<LoadResult> {
  const cached = clientCache.get(companyNr);
  if (cached && Date.now() - cached.fetchedAt < STALE_MS) {
    return Promise.resolve({ rows: cached.rows });
  }

  const pending = pendingFetches.get(companyNr);
  if (pending) return pending;

  const promise: Promise<LoadResult> = fetch(
    `/api/trantotals?companyNr=${encodeURIComponent(companyNr)}`,
  )
    .then((r) => r.json())
    .then((result): LoadResult => {
      // Response shape: { success, data: { success, data: { tranTotals, totalRows } } }
      // — our route wraps the full Revelation response in { success: true, data: ... },
      //   matching how app/api/customers/ageanalysis/route.ts wraps its response.
      const tranTotals =
        (result?.data as { data?: { tranTotals?: TranTotalRow[] } })?.data
          ?.tranTotals ?? [];
      if (result.success) {
        clientCache.set(companyNr, { rows: tranTotals, fetchedAt: Date.now() });
        return { rows: tranTotals };
      }
      return { error: result.message ?? "Failed to load sales data" };
    })
    .catch((): LoadResult => ({
      error: "Network error — could not load sales data",
    }))
    .finally(() => {
      pendingFetches.delete(companyNr);
    });

  pendingFetches.set(companyNr, promise);
  return promise;
}

// Fire-and-forget warm-up (e.g. on company-select) — the dashboard then mounts
// onto the in-flight request or the populated cache.
export function prefetchTranTotals(companyNr: string): void {
  void loadTranTotals(companyNr);
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useTranTotals(companyNr: string | null): UseTranTotalsResult {
  const [rows, setRows] = useState<TranTotalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Incrementing this forces a refetch even when companyNr hasn't changed.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!companyNr) return;

    // Serve from cache if still fresh
    const cached = clientCache.get(companyNr);
    if (cached && Date.now() - cached.fetchedAt < STALE_MS) {
      setRows(cached.rows);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    loadTranTotals(companyNr)
      .then((result) => {
        if (!active) return;
        if ("rows" in result) {
          setRows(result.rows);
        } else {
          setError(result.error);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [companyNr, tick]);

  const refetch = () => {
    if (companyNr) clientCache.delete(companyNr);
    setTick((t) => t + 1);
  };

  return { rows, loading, error, refetch };
}
