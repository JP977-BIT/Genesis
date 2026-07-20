"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search } from "lucide-react";
import SortableHeader, { type SortDirection } from "./SortableHeader";
import CreateStockModal from "./CreateStockModal";

interface StockItem {
  dbId: number;
  code: string;
  description: string;
  category: string;
  exclPrice: number;
  inclPrice: number;
  onHand: number;
  available: number;
}

// Raw shape from /api/stock — cat is nested, everything else passes through
interface StockHeader {
  dbId: number;
  code: string | null;
  description: string | null;
  cat: { id: number; code: string; name: string } | null;
  exclPrice: number;
  inclPrice: number;
  onHand: number;
  available: number;
}

const COLUMN_WIDTHS = ["12%", "30%", "14%", "11%", "11%", "11%", "11%"];

function StockColgroup() {
  return (
    <colgroup>
      {COLUMN_WIDTHS.map((width, i) => (
        <col key={i} style={{ width }} />
      ))}
    </colgroup>
  );
}

function formatMoney(value: number) {
  return value.toLocaleString("en-ZA", { minimumFractionDigits: 2 });
}

export default function StockList({ companyNr }: { companyNr: string | null }) {
  const router = useRouter();
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<keyof StockItem | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const handleSort = (column: keyof StockItem) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const displayedItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = term
      ? items.filter(
          (item) =>
            item.code.toLowerCase().includes(term) ||
            item.description.toLowerCase().includes(term) ||
            item.category.toLowerCase().includes(term),
        )
      : items;

    if (!sortColumn) return filtered;

    return [...filtered].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      let comparison = 0;
      if (typeof aValue === "string" && typeof bValue === "string") {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === "number" && typeof bValue === "number") {
        comparison = aValue - bValue;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [items, searchTerm, sortColumn, sortDirection]);

  const virtualizer = useVirtualizer({
    count: displayedItems.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 45,
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();

  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0;

  useEffect(() => {
    if (!companyNr) return;
    let isActive = true;

    const fetchStock = async () => {
      setLoading(true);
      try {
        const result = await fetch(
          `/api/stock?companyNr=${companyNr}&numberOfRecords=5000`,
        ).then((r) => r.json());

        if (!isActive) return;

        if (result.success) {
          const headers: StockHeader[] = result.data.stockHeaders ?? [];
          // Revelation can return the same item more than once (e.g. one row
          // per warehouse when querying warehouseNr 0) — keep the first
          // occurrence so codes stay unique in the list.
          const seen = new Set<string>();
          const deduped: StockItem[] = [];
          for (const h of headers) {
            const key = `${h.dbId}|${h.code ?? ""}`;
            if (seen.has(key)) continue;
            seen.add(key);
            deduped.push({
              dbId: h.dbId,
              code: h.code ?? "",
              description: h.description ?? "",
              category: h.cat?.name ?? "",
              exclPrice: h.exclPrice ?? 0,
              inclPrice: h.inclPrice ?? 0,
              onHand: h.onHand ?? 0,
              available: h.available ?? 0,
            });
          }
          setItems(deduped);
        }
      } catch (err) {
        console.error("Failed to fetch stock items:", err);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    fetchStock();
    return () => {
      isActive = false;
    };
  }, [companyNr, fetchKey]);

  return (
    <>
    <div className="bg-white rounded-md shadow-sm overflow-hidden flex flex-col h-full">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-gray-700">Stock</p>
          <p className="text-xs text-gray-400">
            {displayedItems.length} of {items.length} items
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="h-7 px-3 rounded-md bg-[#0d9488] text-white text-[12px] font-medium hover:bg-[#0b7c72] transition shrink-0"
          >
            + New Item
          </button>

          <div className="relative w-72">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search stock..."
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0d9488]/20 focus:border-[#0d9488] transition"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 px-5 py-4">Loading stock...</p>
      ) : (
        <>
          <div className="shrink-0 pr-[15px]">
            <table className="w-full text-sm table-fixed">
              <StockColgroup />
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <SortableHeader
                    label="Code"
                    column="code"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Description"
                    column="description"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Category"
                    column="category"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Excl Price"
                    column="exclPrice"
                    align="right"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Incl Price"
                    column="inclPrice"
                    align="right"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="On Hand"
                    column="onHand"
                    align="right"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Available"
                    column="available"
                    align="right"
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                </tr>
              </thead>
            </table>
          </div>

          {displayedItems.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-400">
                {items.length === 0
                  ? "No stock items found"
                  : `No stock items match “${searchTerm}”`}
              </p>
            </div>
          ) : (
            <div ref={tableContainerRef} className="flex-1 overflow-auto">
              <table className="w-full text-sm table-fixed">
                <StockColgroup />
                <tbody>
                  {paddingTop > 0 && (
                    <tr>
                      <td colSpan={7} style={{ height: paddingTop }} />
                    </tr>
                  )}

                  {virtualItems.map((virtualRow) => {
                    const item = displayedItems[virtualRow.index];
                    return (
                      <tr
                        key={`${item.dbId}|${item.code}`}
                        onClick={() =>
                          router.push(
                            `/Finance/stock/${encodeURIComponent(item.code)}`,
                          )
                        }
                        className="hover:bg-gray-50 transition border-b border-gray-100 cursor-pointer"
                      >
                        <td className="px-5 py-3 font-mono text-xs text-[#0f766e] truncate">
                          {item.code}
                        </td>
                        <td className="px-5 py-3 font-medium text-gray-800 truncate">
                          {item.description}
                        </td>
                        <td className="px-5 py-3 text-gray-500 truncate">
                          {item.category}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-gray-700">
                          {formatMoney(item.exclPrice)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-gray-700">
                          {formatMoney(item.inclPrice)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-gray-700">
                          {item.onHand.toLocaleString("en-ZA")}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-gray-700">
                          {item.available.toLocaleString("en-ZA")}
                        </td>
                      </tr>
                    );
                  })}

                  {paddingBottom > 0 && (
                    <tr>
                      <td colSpan={7} style={{ height: paddingBottom }} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>

    <CreateStockModal
      isOpen={showCreate}
      companyNr={companyNr}
      existingCodes={items.map((i) => i.code)}
      onClose={() => setShowCreate(false)}
      onCreated={() => setFetchKey((k) => k + 1)}
    />
    </>
  );
}
