"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  User,
  MessageCircle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
} from "lucide-react";
import FinanceSidebar from "./components/financeSidebar";
import { consumeCustomerPrefetch } from "@/src/lib/prefetch/customers";

interface Customer {
  accNo: string;
  name: string;
  phone: string;
  contact: string;
  balance: number;
  activeYN: boolean;
}

type SortDirection = "asc" | "desc";

// Reusable clickable column header. Shows a chevron for the active sort
// column, and a faint up/down icon for columns that *can* be sorted.
type SortableHeaderProps = {
  label: string;
  column: keyof Customer;
  align?: "left" | "right" | "center";
  sortColumn: keyof Customer | null;
  sortDirection: SortDirection;
  onSort: (column: keyof Customer) => void;
};

function SortableHeader({
  label,
  column,
  align = "left",
  sortColumn,
  sortDirection,
  onSort,
}: SortableHeaderProps) {
  const isActive = sortColumn === column;

  const thAlign =
    align === "right"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : "text-left";

  const buttonAlign =
    align === "right"
      ? "justify-end"
      : align === "center"
        ? "justify-center"
        : "justify-start";

  return (
    <th className={`px-5 py-3 ${thAlign}`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`flex items-center gap-1 w-full uppercase hover:text-[#1B3D35] transition ${buttonAlign}`}
      >
        <span>{label}</span>
        {isActive ? (
          sortDirection === "asc" ? (
            <ChevronUp size={14} />
          ) : (
            <ChevronDown size={14} />
          )
        ) : (
          <ChevronsUpDown size={14} className="text-gray-300" />
        )}
      </button>
    </th>
  );
}

export default function FinancePage() {
  const searchParams = useSearchParams();
  const [activeItem, setActiveItem] = useState(
    () => searchParams.get("view") ?? "Dashboard",
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const router = useRouter();

  // --- Search + sort state ---
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<keyof Customer | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const handleSort = (column: keyof Customer) => {
    if (sortColumn === column) {
      // Clicking the same column flips the direction (asc <-> desc)
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      // Clicking a new column starts it ascending
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // The assembly line: FILTER first, then SORT. The original `customers`
  // array is never mutated. Recomputed only when data / search / sort change.
  const displayedCustomers = useMemo(() => {
    // Station 1 — filter by the search term across the text fields
    const term = searchTerm.trim().toLowerCase();
    const filtered = term
      ? customers.filter(
          (c) =>
            c.name.toLowerCase().includes(term) ||
            c.accNo.toLowerCase().includes(term) ||
            c.contact.toLowerCase().includes(term) ||
            c.phone.toLowerCase().includes(term),
        )
      : customers;

    // Station 2 — sort whatever survived the filter
    if (!sortColumn) return filtered;

    return [...filtered].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      let comparison = 0;
      if (typeof aValue === "string" && typeof bValue === "string") {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === "number" && typeof bValue === "number") {
        comparison = aValue - bValue;
      } else if (typeof aValue === "boolean" && typeof bValue === "boolean") {
        comparison = Number(aValue) - Number(bValue);
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [customers, searchTerm, sortColumn, sortDirection]);

  // IMPORTANT: the virtualizer counts the DERIVED array, not `customers`.
  const virtualizer = useVirtualizer({
    count: displayedCustomers.length,
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
    let isActive = true;

    const stored = localStorage.getItem("selectedCompany");
    if (!stored) return;

    let company;
    try {
      company = JSON.parse(stored);
    } catch (err) {
      console.error("Failed to parse company from localStorage:", err);
      return;
    }

    const fetchCustomers = async () => {
      setLoadingCustomers(true);

      try {
        // Use the in-flight prefetch started on company-select if available
        const prefetch = consumeCustomerPrefetch(String(company.companyNr));
        const customers = prefetch
          ? await prefetch
          : await fetch(
              `/api/customers?companyNr=${company.companyNr}&numberOfRecords=5000`,
            )
              .then((r) => r.json())
              .then((result) =>
                result.success ? result.data.customers : null,
              );

        if (!isActive) return;

        if (customers) {
          setCustomers(customers as Customer[]);
        }
      } catch (err) {
        console.error("Failed to fetch customers:", err);
      } finally {
        if (isActive) setLoadingCustomers(false);
      }
    };

    fetchCustomers();
    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans">
      <div className="flex flex-1 overflow-hidden">
        <FinanceSidebar
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
          activeItem={activeItem}
          setActiveItem={setActiveItem}
        />

        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#1B3D35] flex items-center justify-center">
                <span className="text-white text-[9px] font-semibold tracking-widest">
                  GEN
                </span>
              </div>
              <p className="text-sm text-gray-400">
                Revelation Suite —{" "}
                <span className="font-bold text-gray-800 tracking-wide">
                  FINANCE
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button className="text-gray-500 hover:text-[#1B3D35] transition">
                <User size={18} />
              </button>
              <button className="text-gray-500 hover:text-[#1B3D35] transition">
                <MessageCircle size={18} />
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-hidden p-4">
            {activeItem === "Clients" && (
              <div className="bg-white rounded-md shadow-sm overflow-hidden flex flex-col h-full">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-4 shrink-0">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-gray-700">
                      Clients
                    </p>
                    <p className="text-xs text-gray-400">
                      {displayedCustomers.length} of {customers.length} clients
                    </p>
                  </div>

                  <div className="relative w-72">
                    <Search
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search clients..."
                      className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1B3D35]/20 focus:border-[#1B3D35] transition"
                    />
                  </div>
                </div>

                {loadingCustomers ? (
                  <p className="text-sm text-gray-400 px-5 py-4">
                    Loading customers...
                  </p>
                ) : (
                  <>
                    {/* Sticky header table — table-fixed + shared colgroup keeps it aligned */}
                    <div className="shrink-0 pr-[15px]">
                      <table className="w-full text-sm table-fixed">
                        <colgroup>
                          <col className="w-[12%]" />
                          <col className="w-[26%]" />
                          <col className="w-[18%]" />
                          <col className="w-[16%]" />
                          <col className="w-[16%]" />
                          <col className="w-[12%]" />
                        </colgroup>
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                          <tr>
                            <SortableHeader
                              label="Acc No"
                              column="accNo"
                              sortColumn={sortColumn}
                              sortDirection={sortDirection}
                              onSort={handleSort}
                            />
                            <SortableHeader
                              label="Name"
                              column="name"
                              sortColumn={sortColumn}
                              sortDirection={sortDirection}
                              onSort={handleSort}
                            />
                            <SortableHeader
                              label="Contact"
                              column="contact"
                              sortColumn={sortColumn}
                              sortDirection={sortDirection}
                              onSort={handleSort}
                            />
                            <SortableHeader
                              label="Phone"
                              column="phone"
                              sortColumn={sortColumn}
                              sortDirection={sortDirection}
                              onSort={handleSort}
                            />
                            <SortableHeader
                              label="Balance"
                              column="balance"
                              align="right"
                              sortColumn={sortColumn}
                              sortDirection={sortDirection}
                              onSort={handleSort}
                            />
                            <SortableHeader
                              label="Active"
                              column="activeYN"
                              align="center"
                              sortColumn={sortColumn}
                              sortDirection={sortDirection}
                              onSort={handleSort}
                            />
                          </tr>
                        </thead>
                      </table>
                    </div>

                    {displayedCustomers.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center">
                        <p className="text-sm text-gray-400">
                          No clients match &ldquo;{searchTerm}&rdquo;
                        </p>
                      </div>
                    ) : (
                      <div
                        ref={tableContainerRef}
                        className="flex-1 overflow-auto"
                      >
                        <table className="w-full text-sm table-fixed">
                          <colgroup>
                            <col className="w-[12%]" />
                            <col className="w-[26%]" />
                            <col className="w-[18%]" />
                            <col className="w-[16%]" />
                            <col className="w-[16%]" />
                            <col className="w-[12%]" />
                          </colgroup>
                          <tbody>
                            {paddingTop > 0 && (
                              <tr>
                                <td
                                  colSpan={6}
                                  style={{ height: paddingTop }}
                                />
                              </tr>
                            )}

                            {virtualItems.map((virtualRow) => {
                              const customer =
                                displayedCustomers[virtualRow.index];
                              return (
                                <tr
                                  key={customer.accNo}
                                  onClick={() =>
                                    router.push(
                                      `/Finance/clients/${customer.accNo}`,
                                    )
                                  }
                                  className="hover:bg-gray-50 transition border-b border-gray-100 cursor-pointer"
                                >
                                  <td className="px-5 py-3 font-mono text-xs text-[#1B3D35] truncate">
                                    {customer.accNo}
                                  </td>
                                  <td className="px-5 py-3 font-medium text-gray-800 truncate">
                                    {customer.name}
                                  </td>
                                  <td className="px-5 py-3 text-gray-500 truncate">
                                    {customer.contact}
                                  </td>
                                  <td className="px-5 py-3 text-gray-500 truncate">
                                    {customer.phone}
                                  </td>
                                  <td className="px-5 py-3 text-right font-mono text-gray-700">
                                    R{" "}
                                    {customer.balance.toLocaleString("en-ZA", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </td>
                                  <td className="px-5 py-3 text-center">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                        customer.activeYN
                                          ? "bg-green-100 text-green-700"
                                          : "bg-red-100 text-red-700"
                                      }`}
                                    >
                                      {customer.activeYN
                                        ? "Active"
                                        : "Inactive"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}

                            {paddingBottom > 0 && (
                              <tr>
                                <td
                                  colSpan={6}
                                  style={{ height: paddingBottom }}
                                />
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeItem !== "Clients" && (
              <div className="bg-white rounded-md shadow-sm px-5 py-3">
                <p className="text-sm text-gray-400">Finance — {activeItem}</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
