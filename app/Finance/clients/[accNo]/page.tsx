"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Download,
  Edit3,
  GripHorizontal,
  Info,
  MessageSquare,
  Phone,
  Plus,
  TrendingUp,
  User,
} from "lucide-react";
import FinanceSidebar from "@/app/Finance/components/financeSidebar";
import { useScrollSpy } from "./hooks/useScrollSpy";
import { LazySection } from "./components/LazySection";
import { SectionNav } from "./components/SectionNav";
import EditClientModal from "./components/EditClientModal";

// ── Design tokens ─────────────────────────────────────────────────────────────
const labelCls =
  "text-[11px] font-semibold uppercase tracking-[0.05em] text-[#45464d]";

// ── Stable section list (defined outside component for referential stability) ─
const SECTION_IDS = [
  "details",
  "transactions",
  "age-analysis",
  "history",
  "sales-info",
] as const;

const NAV_ITEMS = [
  { id: "details", label: "Details", icon: Info },
  { id: "transactions", label: "Transactions", icon: CreditCard },
  { id: "age-analysis", label: "Age Analysis", icon: BarChart2 },
  { id: "history", label: "History", icon: Clock },
  { id: "sales-info", label: "Sales Info", icon: TrendingUp },
] as const;

// ── Shared section order (localStorage key shared with SectionNav) ─────────
const SECTION_ORDER_KEY = "genesis-client-nav-order";

function loadSectionOrder(): string[] {
  try {
    const saved = localStorage.getItem(SECTION_ORDER_KEY);
    if (saved) {
      const ids = JSON.parse(saved) as string[];
      const valid = ids.filter((id) =>
        (SECTION_IDS as readonly string[]).includes(id),
      );
      const extra = (SECTION_IDS as readonly string[]).filter(
        (id) => !valid.includes(id),
      );
      return [...valid, ...extra];
    }
  } catch {}
  return [...SECTION_IDS];
}

// ── Interfaces ────────────────────────────────────────────────────────────────
interface Customer {
  accNo: string;
  name: string;
  address1: string;
  address2: string;
  address3: string;
  address4: string;
  phone: string;
  fax: string;
  eMail: string;
  contact: string;
  repCode: string;
  category: string;
  gstNumber: string;
  creditLimit: number;
  balance: number;
  activeYN: boolean;
}

interface AgeAnalysis {
  accNo: string;
  accName: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  days120: number;
  days150: number;
  days180: number;
}

interface InvoiceLine {
  mTranKey: string;
  lineNo: number;
  stockCode: string;
  description: string;
  price: number;
  taxCode: string;
  quantity: number;
  discPerCent: number;
  lineTotal: number;
  exclTotal: number;
  costPrice: number;
  docNo: string;
}

interface Transaction {
  sourceType: string;
  tranType: string;
  tranTypeName: string;
  date: string;
  accNo: string;
  accName: string;
  contra: string;
  contraName: string;
  contraType: string;
  ref: string;
  totalValue: number;
  tax: number;
  discount: number;
  status: string;
  statusName: string;
  state: string;
  user: string;
  tranCode: string;
  warehouse: string;
  repCode: string;
  notes: string;
  currencyNo: number;
  localCurrency: string;
  currencyRate: number;
  expDate: string;
  arcDate: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n.toLocaleString("en-ZA", { minimumFractionDigits: 2 });

const isDebitType = (name: string) => /invoice|debit/i.test(name);
const isCreditType = (name: string) => /credit|receipt|payment/i.test(name);
const isExpandable = (name: string) => /invoice|credit/i.test(name);

// ── Lazy data hooks ───────────────────────────────────────────────────────────
// These follow the same fetch pattern already used in this file.
// `enabled` comes from LazySection's hasBeenVisible latch: the fetch only
// starts once the section is about to enter the viewport.

function useTransactions(
  accNo: string,
  companyNr: string | null,
  enabled: boolean,
) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !companyNr) return;

    let active = true;
    setLoading(true);

    fetch(`/api/transactions/debtors?companyNr=${companyNr}&accNo=${accNo}`)
      .then((r) => r.json())
      .then((result) => {
        if (!active) return;
        if (result.success && result.data?.transactions) {
          setTransactions(result.data.transactions);
        }
      })
      .catch(() => {}) // non-critical: table stays empty on network error
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enabled, accNo, companyNr]);

  return { transactions, loading };
}

function useAgeAnalysis(
  accNo: string,
  companyNr: string | null,
  enabled: boolean,
) {
  const [ageAnalysis, setAgeAnalysis] = useState<AgeAnalysis | null>(null);

  useEffect(() => {
    if (!enabled || !companyNr) return;

    let active = true;

    fetch(`/api/customers/ageanalysis?companyNr=${companyNr}&accNo=${accNo}`)
      .then((r) => r.json())
      .then((result) => {
        if (!active) return;
        const data = result?.data?.data?.ageAnalysis;
        if (result.success && data) setAgeAnalysis(data);
      })
      .catch(() => {}); // non-critical: buckets fall back to 0

    return () => {
      active = false;
    };
  }, [enabled, accNo, companyNr]);

  return ageAnalysis;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const accNo = params.accNo as string;

  // ── Sidebar state ──
  const [isExpanded, setIsExpanded] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("sidebar-pinned") === "true",
  );
  const [activeNavItem, setActiveNavItem] = useState("Clients");

  // ── Company key (read once; needed by all lazy fetch hooks) ──
  const [companyNr, setCompanyNr] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("selectedCompany");
      if (stored) {
        const company = JSON.parse(stored) as { companyNr: string };
        setCompanyNr(company.companyNr);
      }
    } catch {}
  }, []);

  // ── Section order — shared between page sections and SectionNav ──
  const [sectionOrder, setSectionOrder] = useState<string[]>(() =>
    typeof window !== "undefined" ? loadSectionOrder() : [...SECTION_IDS],
  );

  const orderedNavItems = sectionOrder
    .map((id) => NAV_ITEMS.find((item) => item.id === id))
    .filter((item): item is (typeof NAV_ITEMS)[number] => item !== undefined);

  const handleSectionReorder = useCallback((newItems: { id: string }[]) => {
    const newOrder = newItems.map((i) => i.id);
    setSectionOrder(newOrder);
    try {
      localStorage.setItem(SECTION_ORDER_KEY, JSON.stringify(newOrder));
    } catch {}
  }, []);

  // ── Customer (eagerly fetched — needed for header immediately) ──
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [rawCustomer, setRawCustomer] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [customerFetchKey, setCustomerFetchKey] = useState(0);

  useEffect(() => {
    if (!accNo || !companyNr) return;

    let active = true;

    (async () => {
      try {
        const res = await fetch(
          `/api/customers/customer?companyNr=${companyNr}&accNo=${accNo}`,
        );
        const result = await res.json();
        if (!active) return;

        const data = result?.data?.data?.customer;
        if (result.success && data) {
          setCustomer(data as Customer);
          setRawCustomer(data as Record<string, unknown>);
        } else {
          setError("Customer not found.");
        }
      } catch {
        if (active) setError("Failed to load customer.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [accNo, companyNr, customerFetchKey]);

  // ── Internal notes ──
  const [notes, setNotes] = useState("");

  // ── Transaction expand / filter / line-items ──
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [txFilter, setTxFilter] = useState("All");
  const [lineItems, setLineItems] = useState<Record<string, InvoiceLine[]>>({});
  const [loadingLines, setLoadingLines] = useState<Record<string, boolean>>({});

  const fetchLineItems = useCallback(
    async (docNo: string) => {
      if (lineItems[docNo] || loadingLines[docNo] || !companyNr) return;

      setLoadingLines((prev) => ({ ...prev, [docNo]: true }));
      try {
        const res = await fetch(
          `/api/customertransactions/invoice?companyNr=${companyNr}&invoiceNr=${docNo}&warehouseNr=0`,
        );
        const result = await res.json();
        setLineItems((prev) => ({
          ...prev,
          [docNo]: result?.data?.invoice?.body ?? [],
        }));
      } catch {
        setLineItems((prev) => ({ ...prev, [docNo]: [] }));
      } finally {
        setLoadingLines((prev) => ({ ...prev, [docNo]: false }));
      }
    },
    [companyNr, lineItems, loadingLines],
  );

  // ── Page-level section drag-to-reorder (dnd-kit) ──
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const pageSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handlePageDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handlePageDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragId(null);
      if (!over || active.id === over.id) return;
      setSectionOrder((prev) => {
        const next = arrayMove(
          prev,
          prev.indexOf(active.id as string),
          prev.indexOf(over.id as string),
        );
        try {
          localStorage.setItem(SECTION_ORDER_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [],
  );

  // ── Dockable nav panel ──
  const [dockPosition, setDockPosition] = useState<
    "left" | "right" | "top" | "bottom"
  >("left");
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [snapTarget, setSnapTarget] = useState<
    "left" | "right" | "top" | "bottom" | null
  >(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const snapTargetRef = useRef<"left" | "right" | "top" | "bottom" | null>(
    null,
  );

  const handleNavDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const panel = (e.currentTarget as HTMLElement).closest(
      "[data-nav-panel]",
    ) as HTMLElement | null;
    const rect = (panel ?? e.currentTarget).getBoundingClientRect();
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setDragPos({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent) => {
      setDragPos({ x: e.clientX, y: e.clientY });
      const W = window.innerWidth;
      const H = window.innerHeight;
      const SNAP = 120;
      const sbW = isExpanded ? 192 : 56;
      const dL = e.clientX - sbW;
      const dR = W - e.clientX;
      const dT = e.clientY;
      const dB = H - e.clientY;
      const min = Math.min(dL, dR, dT, dB);

      let target: "left" | "right" | "top" | "bottom" | null = null;
      if (min <= SNAP) {
        if (min === dL) target = "left";
        else if (min === dR) target = "right";
        else if (min === dT) target = "top";
        else target = "bottom";
      }
      snapTargetRef.current = target;
      setSnapTarget(target);
    };

    const onUp = () => {
      if (snapTargetRef.current) setDockPosition(snapTargetRef.current);
      setIsDragging(false);
      setSnapTarget(null);
      snapTargetRef.current = null;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, isExpanded]);

  // ── Scrollspy ──
  // useState-backed callback ref: when React assigns the <main> element, the
  // state update causes a re-render, which re-runs useScrollSpy's effect with
  // the real element as root — avoiding the null-on-first-run timing hole that
  // a plain useRef would have.
  const [mainEl, setMainEl] = useState<HTMLElement | null>(null);
  const { activeSection, scrollToSection } = useScrollSpy(sectionOrder, mainEl);

  // ── Derived values ──
  const totalOutstanding = customer?.balance ?? 0;
  const creditAvailable = Math.max(
    0,
    (customer?.creditLimit ?? 0) - (customer?.balance ?? 0),
  );

  // ── Section content renderer ──────────────────────────────────────────────
  const renderSectionContent = (id: string) => {
    switch (id) {
      case "details":
        return (
          <LazySection id="details">
            {() => (
              <div className="space-y-5">
                <section>
                  <h2 className="text-[15px] font-semibold text-[#0b1c30] mb-4">
                    Details
                  </h2>
                  <div className="flex divide-x divide-[#c6c6cd]">
                    <div className="pr-12">
                      <p className={`${labelCls} mb-1.5`}>TOTAL OUTSTANDING</p>
                      <p className="text-[30px] font-bold text-[#0b1c30] leading-none">
                        {totalOutstanding.toLocaleString("en-ZA", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    <div className="px-12">
                      <p className={`${labelCls} mb-1.5`}>OVERDUE</p>
                      <p className="text-[30px] font-bold text-[#ba1a1a] leading-none">
                        0.00
                      </p>
                    </div>
                    <div className="pl-12">
                      <p className={`${labelCls} mb-1.5`}>CREDIT AVAILABLE</p>
                      <p className="text-[30px] font-bold text-[#009668] leading-none">
                        {creditAvailable.toLocaleString("en-ZA", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>
                </section>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg border border-[#c6c6cd] shadow-[0px_1px_2px_rgba(15,23,42,0.05)] p-5 flex flex-col">
                    <h3 className="text-[15px] font-semibold text-[#0b1c30] mb-3">
                      Contact Information
                    </h3>
                    <div className="flex flex-col flex-1">
                      {[
                        {
                          label: "Contact Person",
                          value: customer!.contact || "—",
                          icons: ["phone"] as const,
                        },
                        {
                          label: "Phone",
                          value: customer!.phone || "—",
                          icons: ["phone"] as const,
                        },
                        {
                          label: "Fax",
                          value: customer!.fax || "—",
                          icons: ["phone"] as const,
                        },
                        {
                          label: "Email",
                          value: customer!.eMail?.trim() || "—",
                          icons: ["message", "copy"] as const,
                        },
                      ].map((row) => (
                        <div
                          key={row.label}
                          className="flex items-center justify-between py-3 border-b border-[#c6c6cd]/40 last:border-0"
                        >
                          <div>
                            <p className={labelCls}>{row.label}</p>
                            <p className="text-[14px] text-[#0b1c30] mt-0.5">
                              {row.value}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {row.icons.map((icon) => (
                              <button
                                key={icon}
                                className="w-7 h-7 rounded border border-[#c6c6cd] bg-white flex items-center justify-center text-[#76777d] hover:border-[#5bb8fe] hover:text-[#006398] transition-colors"
                              >
                                {icon === "phone" && <Phone size={12} />}
                                {icon === "message" && (
                                  <MessageSquare size={12} />
                                )}
                                {icon === "copy" && <Copy size={12} />}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-[#c6c6cd] shadow-[0px_1px_2px_rgba(15,23,42,0.05)] p-5 flex flex-col">
                    <h3 className="text-[15px] font-semibold text-[#0b1c30] mb-4">
                      Financial &amp; Admin
                    </h3>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-5 mb-6">
                      <div>
                        <p className={`${labelCls} mb-1`}>VAT Number</p>
                        <p className="text-[14px] text-[#0b1c30]">
                          {customer!.gstNumber || "—"}
                        </p>
                      </div>
                      <div>
                        <p className={`${labelCls} mb-1`}>Credit Limit</p>
                        <p className="text-[14px] text-[#0b1c30]">
                          {customer!.creditLimit.toLocaleString("en-ZA", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                      <div>
                        <p className={`${labelCls} mb-1`}>Trade Discount</p>
                        <p className="text-[14px] text-[#0b1c30]">—</p>
                      </div>
                      <div>
                        <p className={`${labelCls} mb-1`}>Tax Status</p>
                        <span className="inline-flex items-center text-[11px] font-semibold text-[#009668] bg-[#009668]/10 border border-[#009668]/20 px-2.5 py-0.5 rounded-full">
                          Compliant
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#76777d] mb-3">
                        CLASSIFICATION
                      </p>
                      <div className="grid grid-cols-3 gap-x-4">
                        <div>
                          <p className={`${labelCls} mb-1`}>Rep Code</p>
                          <p className="text-[14px] text-[#0b1c30]">
                            {customer!.repCode || "—"}
                          </p>
                        </div>
                        <div>
                          <p className={`${labelCls} mb-1`}>Area Code</p>
                          <p className="text-[14px] text-[#0b1c30]">
                            {customer!.category || "—"}
                          </p>
                        </div>
                        <div>
                          <p className={`${labelCls} mb-1`}>Terms</p>
                          <p className="text-[14px] text-[#0b1c30]">30 Days</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-[#c6c6cd] shadow-[0px_1px_2px_rgba(15,23,42,0.05)] p-5 flex flex-col">
                    <h3 className="text-[15px] font-semibold text-[#0b1c30] mb-3">
                      Internal Notes
                    </h3>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add internal notes about this client…"
                      className="flex-1 w-full resize-none text-[14px] text-[#0b1c30] placeholder:text-[#b0b1b8] focus:outline-none leading-relaxed min-h-[180px]"
                    />
                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#c6c6cd]/40">
                      <p className="text-[11px] text-[#b0b1b8]">
                        {notes.length > 0
                          ? `${notes.length} characters`
                          : "Not saved yet"}
                      </p>
                      <button
                        onClick={() => alert("Notes saving coming soon!")}
                        className="h-7 px-3 rounded bg-[#0b1c30] text-white text-[12px] font-medium hover:bg-[#131b2e] transition-colors"
                      >
                        Save Notes
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </LazySection>
        );

      case "transactions":
        return (
          <LazySection id="transactions">
            {(enabled) => (
              <TransactionsSection
                accNo={accNo}
                companyNr={companyNr}
                enabled={enabled}
                expandedDoc={expandedDoc}
                setExpandedDoc={setExpandedDoc}
                txFilter={txFilter}
                setTxFilter={setTxFilter}
                lineItems={lineItems}
                loadingLines={loadingLines}
                fetchLineItems={fetchLineItems}
              />
            )}
          </LazySection>
        );

      case "age-analysis":
        return (
          <LazySection id="age-analysis">
            {(enabled) => (
              <AgeAnalysisSection
                accNo={accNo}
                companyNr={companyNr}
                enabled={enabled}
                customer={customer!}
              />
            )}
          </LazySection>
        );

      case "history":
        return (
          <LazySection id="history">
            {() => (
              <div>
                <h2 className="text-[15px] font-semibold text-[#0b1c30] mb-4">
                  History
                </h2>
                <div className="bg-white rounded-lg border border-[#c6c6cd] py-16 text-center">
                  <p className="text-sm text-[#76777d]">
                    Account history coming soon
                  </p>
                </div>
              </div>
            )}
          </LazySection>
        );

      case "sales-info":
        return (
          <LazySection id="sales-info">
            {() => (
              <div>
                <h2 className="text-[15px] font-semibold text-[#0b1c30] mb-4">
                  Sales Info
                </h2>
                <div className="bg-white rounded-lg border border-[#c6c6cd] py-16 text-center">
                  <p className="text-sm text-[#76777d]">
                    Sales information coming soon
                  </p>
                </div>
              </div>
            )}
          </LazySection>
        );

      default:
        return null;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#f8f9ff] font-body">
      <FinanceSidebar
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
        activeItem={activeNavItem}
        setActiveItem={setActiveNavItem}
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* ── Loading state ── */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-[#76777d]">Loading client…</p>
          </div>
        )}

        {/* ── Error state ── */}
        {error && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <p className="text-sm text-[#ba1a1a]">{error}</p>
            <button
              onClick={() => router.push("/Finance?view=Clients")}
              className="h-8 px-4 rounded border border-[#c6c6cd] bg-white text-[#0b1c30] text-sm font-medium flex items-center gap-1.5 hover:bg-[#f8f9ff] transition-colors"
            >
              <ArrowLeft size={14} /> Back to Clients
            </button>
          </div>
        )}

        {customer && !loading && !error && (
          <>
            {/* ── Client header ── */}
            <header className="bg-white border-b border-[#c6c6cd] px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push("/Finance?view=Clients")}
                  className="w-8 h-8 rounded border border-[#c6c6cd] bg-white flex items-center justify-center text-[#45464d] hover:bg-[#f8f9ff] hover:text-[#0b1c30] transition-colors shrink-0"
                  title="Back to Clients"
                >
                  <ArrowLeft size={15} />
                </button>
                <div className="w-px h-6 bg-[#c6c6cd]/60 shrink-0" />
                <div className="w-10 h-10 rounded bg-[#e8eaf0] flex items-center justify-center shrink-0">
                  <User size={20} className="text-[#45464d]" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="font-semibold text-[16px] text-[#0b1c30]">
                      {customer.name}
                    </h1>
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                        customer.activeYN
                          ? "bg-[#009668]/10 text-[#009668] border-[#009668]/25"
                          : "bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/25"
                      }`}
                    >
                      {customer.activeYN ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#45464d] mt-0.5">
                    {customer.eMail?.trim() || "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="h-8 px-4 rounded border border-[#c6c6cd] bg-white text-[#0b1c30] text-sm font-medium flex items-center gap-1.5 hover:bg-[#f8f9ff] transition-colors">
                  <Download size={14} /> Export
                </button>
                <button
                  onClick={() => setShowEdit(true)}
                  className="h-8 px-4 rounded border border-[#c6c6cd] bg-white text-[#0b1c30] text-sm font-medium flex items-center gap-1.5 hover:bg-[#f8f9ff] transition-colors"
                >
                  <Edit3 size={14} /> Edit Client
                </button>
                <button className="h-8 px-4 rounded bg-[#0b1c30] text-white text-sm font-semibold flex items-center gap-1.5 hover:bg-[#131b2e] transition-colors">
                  <Plus size={14} /> New Entry
                </button>
              </div>
            </header>

            {/* ── Body: dockable secondary nav + scrollable content ── */}
            <div
              className={`flex flex-1 overflow-hidden relative ${
                dockPosition === "top"
                  ? "flex-col"
                  : dockPosition === "bottom"
                    ? "flex-col-reverse"
                    : dockPosition === "right"
                      ? "flex-row-reverse"
                      : "flex-row"
              }`}
            >
              {/* ── Secondary nav panel (now scroll-links, not tab-switches) ── */}
              <SectionNav
                orderedItems={orderedNavItems}
                onReorder={handleSectionReorder}
                activeSection={activeSection}
                onNav={scrollToSection}
                dockPosition={dockPosition}
                isDragging={isDragging}
                onDragStart={handleNavDragStart}
              />

              {/* ── Scrollable content — sections rendered in drag order ── */}
              <main
                ref={setMainEl}
                className={`flex-1 overflow-y-auto p-6 ${
                  dockPosition === "left" ? "pl-2" : "pl-6"
                }`}
              >
                <DndContext
                  sensors={pageSensors}
                  collisionDetection={closestCenter}
                  onDragStart={handlePageDragStart}
                  onDragEnd={handlePageDragEnd}
                >
                  <SortableContext
                    items={sectionOrder}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-8">
                      {sectionOrder.map((sectionId, index) => (
                        <React.Fragment key={sectionId}>
                          {index > 0 && (
                            <div className="border-t border-[#c6c6cd]/60" />
                          )}
                          <SortablePageSection id={sectionId}>
                            {renderSectionContent(sectionId)}
                          </SortablePageSection>
                        </React.Fragment>
                      ))}
                    </div>
                  </SortableContext>

                  <DragOverlay>
                    {activeDragId ? (
                      <div className="bg-white rounded-lg border-2 border-[#006398] shadow-[0_8px_24px_rgba(15,23,42,0.2)] px-4 py-3 flex items-center gap-2.5 cursor-grabbing select-none">
                        <GripHorizontal
                          size={14}
                          className="text-[#006398] shrink-0"
                        />
                        <span className="text-[13px] font-semibold text-[#0b1c30]">
                          {NAV_ITEMS.find((i) => i.id === activeDragId)
                            ?.label ?? activeDragId}
                        </span>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>

                {/* Bottom breathing room */}
                <div className="pb-6" />
              </main>

              {/* ── Drag overlay: drop zones + floating clone ── */}
              {isDragging && (
                <>
                  {(["left", "right", "top", "bottom"] as const).map((zone) => (
                    <div
                      key={zone}
                      style={
                        zone === "left"
                          ? { left: isExpanded ? 192 : 56 }
                          : undefined
                      }
                      className={`fixed z-40 pointer-events-none flex items-center justify-center transition-colors ${
                        zone === "left"
                          ? "top-0 h-full w-24"
                          : zone === "right"
                            ? "right-0 top-0 h-full w-24"
                            : zone === "top"
                              ? "top-0 left-0 w-full h-24"
                              : "bottom-0 left-0 w-full h-24"
                      } ${
                        snapTarget === zone
                          ? "bg-[#006398]/50"
                          : "bg-[#006398]/25"
                      }`}
                    >
                      <div
                        className={`rounded-full transition-all ${
                          snapTarget === zone
                            ? "bg-[#006398] scale-125"
                            : "bg-[#006398]/70"
                        } ${
                          zone === "left" || zone === "right"
                            ? "w-1.5 h-16"
                            : "w-16 h-1.5"
                        }`}
                      />
                    </div>
                  ))}

                  {/* Floating nav clone that follows the cursor */}
                  <div
                    style={{
                      position: "fixed",
                      left: dragPos.x - dragOffsetRef.current.x,
                      top: dragPos.y - dragOffsetRef.current.y,
                      zIndex: 50,
                      pointerEvents: "none",
                    }}
                    className="opacity-90 select-none"
                  >
                    <nav className="bg-white rounded-lg border border-[#c6c6cd] shadow-[0px_8px_24px_rgba(15,23,42,0.15)] overflow-hidden w-52">
                      <div className="px-4 py-2 border-b border-[#c6c6cd]/50 flex items-center gap-2 bg-[#f8f9ff]">
                        <GripHorizontal size={12} className="text-[#76777d]" />
                        <span className="text-[11px] font-semibold text-[#76777d] uppercase tracking-wide">
                          Navigation
                        </span>
                      </div>
                      {orderedNavItems.map(({ id, label, icon: Icon }) => (
                        <div
                          key={id}
                          className={`w-full px-4 py-2.5 text-[13px] font-medium border-b border-[#c6c6cd]/50 last:border-0 flex items-center gap-2.5 ${
                            activeSection === id
                              ? "bg-[#eff4ff] text-[#006398]"
                              : "text-[#45464d]"
                          }`}
                        >
                          <Icon size={14} className="shrink-0" />
                          {label}
                        </div>
                      ))}
                    </nav>
                  </div>
                </>
              )}
            </div>

            <EditClientModal
              isOpen={showEdit}
              companyNr={companyNr}
              rawCustomer={rawCustomer}
              onClose={() => setShowEdit(false)}
              onUpdated={() => {
                setCustomerFetchKey((k) => k + 1);
                setLoading(true);
              }}
            />

            {/* ── Footer ── */}
            <footer className="bg-white border-t border-[#c6c6cd] px-6 py-3 flex items-center justify-between shrink-0">
              <p className="text-[12px] text-[#45464d]">
                © 2024 Revelation Suite Finance Operations
              </p>
              <div className="flex items-center gap-5">
                <a
                  href="#"
                  className="text-[12px] text-[#45464d] hover:text-[#006398] transition-colors"
                >
                  Privacy Policy
                </a>
                <a
                  href="#"
                  className="text-[12px] text-[#45464d] hover:text-[#006398] transition-colors"
                >
                  Terms of Service
                </a>
                <a
                  href="#"
                  className="text-[12px] text-[#45464d] hover:text-[#006398] transition-colors"
                >
                  Support
                </a>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

// ── Section sub-components ─────────────────────────────────────────────────────
// Defined below the page export so they can use hooks but still share types
// from this file. They are NOT exported — they are local to this route.

function SortablePageSection({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
      }}
      {...attributes}
      className="relative group"
    >
      {/* Spreading listeners only on the handle restricts drag to this icon */}
      <div
        {...listeners}
        className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1.5 text-[#b0b1b8] hover:text-[#76777d] z-10 touch-none"
        title="Drag to reorder"
      >
        <GripHorizontal size={14} />
      </div>
      {children}
    </div>
  );
}

interface TransactionsSectionProps {
  accNo: string;
  companyNr: string | null;
  enabled: boolean;
  expandedDoc: string | null;
  setExpandedDoc: React.Dispatch<React.SetStateAction<string | null>>;
  txFilter: string;
  setTxFilter: React.Dispatch<React.SetStateAction<string>>;
  lineItems: Record<string, InvoiceLine[]>;
  loadingLines: Record<string, boolean>;
  fetchLineItems: (docNo: string) => Promise<void>;
}

function TransactionsSection({
  accNo,
  companyNr,
  enabled,
  expandedDoc,
  setExpandedDoc,
  txFilter,
  setTxFilter,
  lineItems,
  loadingLines,
  fetchLineItems,
}: TransactionsSectionProps) {
  const { transactions, loading: transactionsLoading } = useTransactions(
    accNo,
    companyNr,
    enabled,
  );

  const totalInvoiced = transactions
    .filter((t) => isDebitType(t.tranTypeName))
    .reduce((s, t) => s + t.totalValue, 0);

  const totalReceived = transactions
    .filter((t) => isCreditType(t.tranTypeName))
    .reduce((s, t) => s + t.totalValue, 0);

  return (
    <div className="space-y-5">
      <h2 className="text-[15px] font-semibold text-[#0b1c30]">Transactions</h2>

      {/* Summary */}
      <div className="flex divide-x divide-[#c6c6cd]">
        <div className="pr-12">
          <p className={`${labelCls} mb-1.5`}>TOTAL INVOICED</p>
          <p className="text-[30px] font-bold text-[#0b1c30] leading-none">
            {transactionsLoading ? "—" : fmt(totalInvoiced)}
          </p>
        </div>
        <div className="px-12">
          <p className={`${labelCls} mb-1.5`}>TOTAL RECEIVED</p>
          <p className="text-[30px] font-bold text-[#009668] leading-none">
            {transactionsLoading ? "—" : fmt(totalReceived)}
          </p>
        </div>
        <div className="pl-12">
          <p className={`${labelCls} mb-1.5`}>NET</p>
          <p className="text-[30px] font-bold text-[#0b1c30] leading-none">
            {transactionsLoading ? "—" : fmt(totalInvoiced - totalReceived)}
          </p>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          "All",
          ...Array.from(
            new Set(transactions.map((t) => t.tranTypeName)),
          ).sort(),
        ].map((type) => (
          <button
            key={type}
            onClick={() => setTxFilter(type)}
            className={`h-7 px-3.5 rounded-full text-[12px] font-medium transition-colors ${
              txFilter === type
                ? "bg-[#0b1c30] text-white"
                : "bg-white border border-[#c6c6cd] text-[#45464d] hover:border-[#5bb8fe] hover:text-[#006398]"
            }`}
          >
            {type === "All"
              ? `All (${transactions.length})`
              : `${type} (${transactions.filter((t) => t.tranTypeName === type).length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      {transactionsLoading ? (
        <div className="bg-white rounded-lg border border-[#c6c6cd] py-16 text-center">
          <p className="text-sm text-[#76777d]">Loading transactions…</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#c6c6cd] py-16 text-center">
          <p className="text-sm text-[#76777d]">
            No transactions found for this account
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-[#c6c6cd] shadow-[0px_1px_2px_rgba(15,23,42,0.05)] overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[28px_110px_185px_1fr_1fr_130px_100px] gap-3 bg-[#f8f9ff] border-b border-[#c6c6cd] px-4 py-2.5">
            <div />
            <p className={labelCls}>Date</p>
            <p className={labelCls}>Type</p>
            <p className={labelCls}>Ref</p>
            <p className={labelCls}>Description</p>
            <p className={`${labelCls} text-right`}>Amount</p>
            <p className={labelCls}>Status</p>
          </div>

          {/* Data rows */}
          {transactions
            .filter((t) => txFilter === "All" || t.tranTypeName === txFilter)
            .map((tx, idx) => {
              const rowKey = tx.ref + idx;
              const isOpen = expandedDoc === rowKey;
              const canExpand = isExpandable(tx.tranTypeName);
              const isCredit = isCreditType(tx.tranTypeName);
              const isDebit = isDebitType(tx.tranTypeName);

              return (
                <div
                  key={rowKey}
                  className="border-b border-[#c6c6cd]/50 last:border-0"
                >
                  <button
                    onClick={() => {
                      if (canExpand) {
                        if (!isOpen) fetchLineItems(tx.ref);
                        setExpandedDoc(isOpen ? null : rowKey);
                      }
                    }}
                    className={`w-full grid grid-cols-[28px_110px_185px_1fr_1fr_130px_100px] gap-3 px-4 py-3 text-left transition-colors items-center ${
                      canExpand
                        ? "hover:bg-[#f8f9ff] cursor-pointer"
                        : "cursor-default"
                    }`}
                  >
                    <span className="text-[#76777d] flex items-center">
                      {canExpand ? (
                        isOpen ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )
                      ) : null}
                    </span>
                    <span className="text-[13px] text-[#45464d]">
                      {new Date(tx.date).toLocaleDateString("en-ZA", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                          isDebit
                            ? "bg-[#eff4ff] text-[#006398] border-[#006398]/20"
                            : isCredit
                              ? "bg-[#009668]/10 text-[#009668] border-[#009668]/20"
                              : "bg-[#f8f9ff] text-[#45464d] border-[#c6c6cd]"
                        }`}
                      >
                        {tx.tranTypeName}
                      </span>
                    </span>
                    <span className="min-w-0 text-[13px] font-medium text-[#0b1c30] truncate">
                      {tx.ref || "—"}
                    </span>
                    <span className="min-w-0 text-[13px] text-[#45464d] truncate">
                      {tx.contraName || tx.notes || "—"}
                    </span>
                    <span
                      className={`flex justify-end items-center text-[13px] font-semibold ${
                        isCredit ? "text-[#009668]" : "text-[#0b1c30]"
                      }`}
                    >
                      {isCredit ? "− " : ""}
                      {fmt(tx.totalValue)}
                    </span>
                    <span>
                      {tx.statusName ? (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            /paid|closed|settled/i.test(tx.statusName)
                              ? "bg-[#009668]/10 text-[#009668] border-[#009668]/20"
                              : /open|outstanding/i.test(tx.statusName)
                                ? "bg-[#F59E0B]/10 text-[#b45309] border-[#F59E0B]/30"
                                : "bg-[#f8f9ff] text-[#45464d] border-[#c6c6cd]"
                          }`}
                        >
                          {tx.statusName}
                        </span>
                      ) : (
                        <span className="text-[13px] text-[#b0b1b8]">—</span>
                      )}
                    </span>
                  </button>

                  {/* Expanded line items */}
                  {isOpen && canExpand && (
                    <div className="border-t border-[#c6c6cd]/40 bg-[#f8f9ff] px-8 py-3">
                      {loadingLines[tx.ref] ? (
                        <p className="text-[12px] text-[#76777d] py-2">
                          Loading line items…
                        </p>
                      ) : (lineItems[tx.ref] ?? []).length === 0 ? (
                        <p className="text-[12px] text-[#76777d] py-2">
                          No line items found
                        </p>
                      ) : (
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-[#c6c6cd]/50">
                              <th className={`${labelCls} text-left pb-2`}>
                                Stock Code
                              </th>
                              <th className={`${labelCls} text-left pb-2`}>
                                Description
                              </th>
                              <th className={`${labelCls} text-right pb-2`}>
                                Qty
                              </th>
                              <th className={`${labelCls} text-right pb-2`}>
                                Unit Price
                              </th>
                              <th className={`${labelCls} text-right pb-2`}>
                                Disc%
                              </th>
                              <th className={`${labelCls} text-right pb-2`}>
                                Line Total
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {(lineItems[tx.ref] ?? []).map((line, li) => (
                              <tr
                                key={line.mTranKey + li}
                                className="border-b border-[#c6c6cd]/30 last:border-0"
                              >
                                <td className="py-2 text-[12px] text-[#45464d] font-mono">
                                  {line.stockCode}
                                </td>
                                <td className="py-2 text-[12px] text-[#0b1c30]">
                                  {line.description}
                                </td>
                                <td className="py-2 text-[12px] text-right text-[#45464d]">
                                  {line.quantity}
                                </td>
                                <td className="py-2 text-[12px] text-right text-[#45464d]">
                                  {fmt(line.price)}
                                </td>
                                <td className="py-2 text-[12px] text-right text-[#45464d]">
                                  {line.discPerCent > 0
                                    ? `${line.discPerCent}%`
                                    : "—"}
                                </td>
                                <td className="py-2 text-[12px] text-right font-medium text-[#0b1c30]">
                                  {fmt(line.lineTotal)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

interface AgeAnalysisSectionProps {
  accNo: string;
  companyNr: string | null;
  enabled: boolean;
  customer: Customer;
}

function AgeAnalysisSection({
  accNo,
  companyNr,
  enabled,
  customer,
}: AgeAnalysisSectionProps) {
  const ageAnalysis = useAgeAnalysis(accNo, companyNr, enabled);

  const buckets = [
    { label: "CURRENT", value: ageAnalysis?.current ?? 0 },
    { label: "30 DAYS", value: ageAnalysis?.days30 ?? 0 },
    { label: "60 DAYS", value: ageAnalysis?.days60 ?? 0 },
    { label: "90 DAYS", value: ageAnalysis?.days90 ?? 0 },
    { label: "120 DAYS", value: ageAnalysis?.days120 ?? 0 },
    { label: "150 DAYS", value: ageAnalysis?.days150 ?? 0 },
    { label: "180+ DAYS", value: ageAnalysis?.days180 ?? 0 },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-[#0b1c30]">
          Age Analysis
        </h2>
        <p className="text-[12px] text-[#76777d]">Account: {customer.accNo}</p>
      </div>

      {!enabled ? (
        // Skeleton placeholder — visible if the user somehow reaches this
        // section before the IntersectionObserver has fired.
        <div className="bg-white rounded-lg border border-[#c6c6cd] py-10 text-center">
          <p className="text-sm text-[#76777d]">Loading…</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-[#c6c6cd] shadow-[0px_1px_2px_rgba(15,23,42,0.05)] overflow-hidden">
          <div className="grid grid-cols-7 divide-x divide-[#c6c6cd] border-b border-[#c6c6cd] bg-[#f8f9ff]">
            {buckets.map((b) => (
              <div key={b.label} className="px-4 py-3 text-center">
                <p className={labelCls}>{b.label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-[#c6c6cd]">
            {buckets.map((b, i) => (
              <div key={b.label} className="px-4 py-4 text-center">
                <p
                  className={`text-[13px] font-semibold ${
                    i > 0 && b.value > 0 ? "text-[#ba1a1a]" : "text-[#0b1c30]"
                  }`}
                >
                  {b.value.toLocaleString("en-ZA", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
