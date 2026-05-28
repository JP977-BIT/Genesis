"use client";

import { useState, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { User, MessageCircle, Loader2 } from "lucide-react";
import FinanceSidebar from "./components/financeSidebar";

interface Customer {
  accNo: string;
  name: string;
  phone: string;
  contact: string;
  balance: number;
  activeYN: boolean;
}

export default function FinancePage() {
  const [activeItem, setActiveItem] = useState("Dashboard");
  const [isExpanded, setIsExpanded] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: customers.length,
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
      setLoadingMore(true);
      setCustomers([]);

      const CHUNK_SIZE = 50;
      let startingRow = 0;
      let keepGoing = true;

      try {
        while (keepGoing) {
          const response = await fetch(
            `/api/customers?companyNr=${company.companyNr}&startingRow=${startingRow}&numberOfRecords=${CHUNK_SIZE}`,
          );
          const result = await response.json();

          if (!isActive) return;
          if (!result.success) {
            keepGoing = false;
            break;
          }

          const newCustomers: Customer[] = result.data.customers;

          setCustomers((prev) => {
            const existingAccNos = new Set(prev.map((c) => c.accNo));
            const uniqueNew = newCustomers.filter(
              (c) => !existingAccNos.has(c.accNo),
            );
            return [...prev, ...uniqueNew];
          });

          if (startingRow === 0) setLoadingCustomers(false);

          if (newCustomers.length < CHUNK_SIZE) {
            keepGoing = false;
          } else {
            startingRow += CHUNK_SIZE;
          }
        }
      } catch (err) {
        console.error("Failed to fetch customers:", err);
      } finally {
        if (isActive) {
          setLoadingCustomers(false);
          setLoadingMore(false);
        }
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
        {/* Sidebar lives in its own file — won't re-render when customers load */}
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
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
                  <p className="text-sm font-semibold text-gray-700">Clients</p>
                  <p className="text-xs text-gray-400">
                    {customers.length} loaded
                  </p>
                </div>

                {loadingCustomers ? (
                  <p className="text-sm text-gray-400 px-5 py-4">
                    Loading customers...
                  </p>
                ) : (
                  <>
                    {/* Sticky header — outside the scroll container */}
                    <div className="shrink-0">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                          <tr>
                            <th className="px-5 py-3 text-left">Acc No</th>
                            <th className="px-5 py-3 text-left">Name</th>
                            <th className="px-5 py-3 text-left">Contact</th>
                            <th className="px-5 py-3 text-left">Phone</th>
                            <th className="px-5 py-3 text-right">Balance</th>
                            <th className="px-5 py-3 text-center">Active</th>
                          </tr>
                        </thead>
                      </table>
                    </div>

                    {/* Scrollable virtualised body */}
                    <div
                      ref={tableContainerRef}
                      className="flex-1 overflow-auto"
                    >
                      <table className="w-full text-sm">
                        <tbody>
                          {paddingTop > 0 && (
                            <tr>
                              <td colSpan={6} style={{ height: paddingTop }} />
                            </tr>
                          )}

                          {virtualItems.map((virtualRow) => {
                            const customer = customers[virtualRow.index];
                            return (
                              <tr
                                key={customer.accNo}
                                className="hover:bg-gray-50 transition border-b border-gray-100"
                              >
                                <td className="px-5 py-3 font-mono text-xs text-[#1B3D35]">
                                  {customer.accNo}
                                </td>
                                <td className="px-5 py-3 font-medium text-gray-800">
                                  {customer.name}
                                </td>
                                <td className="px-5 py-3 text-gray-500">
                                  {customer.contact}
                                </td>
                                <td className="px-5 py-3 text-gray-500">
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
                                    {customer.activeYN ? "Active" : "Inactive"}
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

                        {loadingMore && (
                          <tfoot>
                            <tr>
                              <td colSpan={6} className="px-5 py-4 text-center">
                                <span className="inline-flex items-center gap-2 text-sm text-gray-400">
                                  <Loader2 size={16} className="animate-spin" />
                                  Loading more clients...
                                </span>
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
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
