// Client-side cache for the per-company stock catalogue, shared by the Stock
// tab list and the quote editor's item search (both hit the identical URL).
// Returns the RAW upstream headers — each consumer keeps its own
// dedupe/mapping to its display shape.

import { createClientCache } from "./prefetch";

// Raw shape from /api/stock — cat is nested, everything else passes through
export interface StockHeader {
  dbId: number;
  code: string | null;
  description: string | null;
  cat: { id: number; code: string; name: string } | null;
  exclPrice: number;
  inclPrice: number;
  onHand: number;
  available: number;
}

const stockCache = createClientCache<StockHeader[]>((companyNr) =>
  fetch(`/api/stock?companyNr=${companyNr}&numberOfRecords=5000`)
    .then((r) => r.json())
    .then((result) => (result.success ? (result.data.stockHeaders ?? []) : null)),
);

export const prefetchStock = stockCache.prefetch;
export const getStockHeaders = stockCache.get;
