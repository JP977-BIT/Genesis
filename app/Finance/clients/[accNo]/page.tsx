"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Phone,
  MessageSquare,
  Copy,
  Download,
  Edit3,
  Plus,
  User,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  GripHorizontal,
  Info,
  CreditCard,
  Clock,
  RefreshCw,
  BarChart2,
} from "lucide-react";
import FinanceSidebar from "@/app/Finance/components/financeSidebar";

const labelCls =
  "text-[11px] font-semibold uppercase tracking-[0.05em] text-[#45464d]";

const NAV_ITEMS = [
  { label: "Details",      icon: Info       },
  { label: "Transactions", icon: CreditCard },
  { label: "History",      icon: Clock      },
  { label: "Recurring",    icon: RefreshCw  },
  { label: "Sales Info",   icon: BarChart2  },
];

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

interface Invoice {
  headerKey: string;
  docNo: string;
  tranType: string;
  accNo: string;
  accName: string;
  date: string;
  orderNo: string;
  repCode: string;
  discPerCent: number;
  goodsValue: number;
  discount: number;
  freight: number;
  tax: number;
  total: number;
  numberOfLines: number;
  body: InvoiceLine[];
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

const fmt = (n: number) =>
  n.toLocaleString("en-ZA", { minimumFractionDigits: 2 });

const isCreditNote = (tranType: string) => /^c/i.test(tranType.trim());

const isDebitType = (name: string) => /invoice|debit/i.test(name);
const isCreditType = (name: string) => /credit|receipt|payment/i.test(name);
const isExpandable = (name: string) => /invoice|credit/i.test(name);

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const accNo = params.accNo as string;

  const [isExpanded, setIsExpanded] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("sidebar-pinned") === "true",
  );
  const [activeNavItem, setActiveNavItem] = useState("Clients");
  const [notes, setNotes] = useState("");

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [ageAnalysis, setAgeAnalysis] = useState<AgeAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("Details");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [txFilter, setTxFilter] = useState("All");
  const [lineItems, setLineItems] = useState<Record<string, InvoiceLine[]>>({});
  const [loadingLines, setLoadingLines] = useState<Record<string, boolean>>({});

  const [dockPosition, setDockPosition] = useState<"left" | "right" | "top" | "bottom">("left");
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [snapTarget, setSnapTarget] = useState<"left" | "right" | "top" | "bottom" | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const snapTargetRef = useRef<"left" | "right" | "top" | "bottom" | null>(null);

  const handleNavDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const panel = (e.currentTarget as HTMLElement).closest("[data-nav-panel]") as HTMLElement | null;
    const rect = (panel ?? e.currentTarget).getBoundingClientRect();
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragPos({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
  };

  useEffect(() => {
    if (!accNo) return;

    const stored = localStorage.getItem("selectedCompany");
    if (!stored) {
      setError("No company selected.");
      setLoading(false);
      return;
    }

    let company: { companyNr: string };
    try {
      company = JSON.parse(stored);
    } catch {
      setError("Could not read company data.");
      setLoading(false);
      return;
    }

    let isActive = true;

    (async () => {
      // ── Customer (critical — its own safety net) ──
      try {
        const customerRes = await fetch(
          `/api/customers/customer?companyNr=${company.companyNr}&accNo=${accNo}`,
        );
        const customerResult = await customerRes.json();

        if (!isActive) return;

        const customerData = customerResult?.data?.data?.customer;
        if (customerResult.success && customerData) {
          setCustomer(customerData);
        } else {
          setError("Customer not found.");
        }
      } catch {
        if (isActive) setError("Failed to load customer.");
      } finally {
        if (isActive) setLoading(false);
      }

      // ── Age Analysis (non-critical — its own safety net) ──
      try {
        const ageRes = await fetch(
          `/api/customers/ageanalysis?companyNr=${company.companyNr}&accNo=${accNo}`,
        );
        const ageResult = await ageRes.json();

        if (!isActive) return;

        const ageData = ageResult?.data?.data?.ageAnalysis;
        if (ageResult.success && ageData) {
          setAgeAnalysis(ageData);
        }
      } catch {
        // Age analysis is optional — if it fails, buckets just stay at R 0.00.
        // We deliberately do NOT setError here, so the page still loads.
      }
    })();

    return () => {
      isActive = false;
    };
  }, [accNo]);

  useEffect(() => {
    if (activeTab !== "Transactions" || !customer) return;

    const stored = localStorage.getItem("selectedCompany");
    if (!stored) return;

    let company: { companyNr: string };
    try {
      company = JSON.parse(stored);
    } catch {
      return;
    }

    let isActive = true;
    setTransactionsLoading(true);

    (async () => {
      try {
        const res = await fetch(
          `/api/transactions/debtors?companyNr=${company.companyNr}&accNo=${accNo}`,
        );
        const result = await res.json();
        if (!isActive) return;
        if (result.success && result.data?.transactions) {
          setTransactions(result.data.transactions);
        }
      } catch {
        // silently fail — transactions are non-critical
      } finally {
        if (isActive) setTransactionsLoading(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [activeTab, accNo, customer]);

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent) => {
      setDragPos({ x: e.clientX, y: e.clientY });
      const W = window.innerWidth;
      const H = window.innerHeight;
      const SNAP = 120;
      const sidebarWidth = isExpanded ? 192 : 56;
      const dL = e.clientX - sidebarWidth;
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

  const fetchLineItems = async (docNo: string) => {
    if (lineItems[docNo] || loadingLines[docNo]) return;

    const stored = localStorage.getItem("selectedCompany");
    if (!stored) return;

    let company: { companyNr: string };
    try {
      company = JSON.parse(stored);
    } catch {
      return;
    }

    setLoadingLines((prev) => ({ ...prev, [docNo]: true }));
    try {
      const res = await fetch(
        `/api/customertransactions/invoice?companyNr=${company.companyNr}&invoiceNr=${docNo}&warehouseNr=0`,
      );
      const result = await res.json();
      const body = result?.data?.invoice?.body ?? [];
      setLineItems((prev) => ({ ...prev, [docNo]: body }));
    } catch {
      setLineItems((prev) => ({ ...prev, [docNo]: [] }));
    } finally {
      setLoadingLines((prev) => ({ ...prev, [docNo]: false }));
    }
  };

  // Derived values (with safe fallbacks while loading)
  const totalOutstanding = customer?.balance ?? 0;
  const creditAvailable = Math.max(
    0,
    (customer?.creditLimit ?? 0) - (customer?.balance ?? 0),
  );

  // Age buckets, paired with their real values (fall back to 0 while loading)
  const ageBuckets = [
    { label: "CURRENT", value: ageAnalysis?.current ?? 0 },
    { label: "30 DAYS", value: ageAnalysis?.days30 ?? 0 },
    { label: "60 DAYS", value: ageAnalysis?.days60 ?? 0 },
    { label: "90 DAYS", value: ageAnalysis?.days90 ?? 0 },
    { label: "120 DAYS", value: ageAnalysis?.days120 ?? 0 },
    { label: "150 DAYS", value: ageAnalysis?.days150 ?? 0 },
    { label: "180+ DAYS", value: ageAnalysis?.days180 ?? 0 },
  ];

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
                <button className="h-8 px-4 rounded border border-[#c6c6cd] bg-white text-[#0b1c30] text-sm font-medium flex items-center gap-1.5 hover:bg-[#f8f9ff] transition-colors">
                  <Edit3 size={14} /> Edit Client
                </button>
                <button className="h-8 px-4 rounded bg-[#0b1c30] text-white text-sm font-semibold flex items-center gap-1.5 hover:bg-[#131b2e] transition-colors">
                  <Plus size={14} /> New Entry
                </button>
              </div>
            </header>

            {/* ── Body: dockable secondary nav + scrollable content ── */}
            <div className={`flex flex-1 overflow-hidden relative ${
              dockPosition === "top"    ? "flex-col" :
              dockPosition === "bottom" ? "flex-col-reverse" :
              dockPosition === "right"  ? "flex-row-reverse" :
              "flex-row"
            }`}>
              {/* ── Secondary nav panel ── */}
              <div
                data-nav-panel="true"
                className={`shrink-0 transition-opacity ${isDragging ? "opacity-30 pointer-events-none" : "opacity-100"} ${
                  dockPosition === "top" || dockPosition === "bottom"
                    ? `bg-white border-[#c6c6cd] flex items-center px-3 py-1 gap-1 ${dockPosition === "top" ? "border-b" : "border-t"}`
                    : `flex flex-col bg-white ${dockPosition === "right" ? "border-l" : "border-r"} border-[#c6c6cd]`
                }`}
              >
                {/* Drag handle */}
                <div
                  onMouseDown={handleNavDragStart}
                  className={`flex items-center justify-center cursor-grab active:cursor-grabbing text-[#b0b1b8] hover:text-[#76777d] transition-colors select-none ${
                    dockPosition === "top" || dockPosition === "bottom"
                      ? "px-1 mr-1"
                      : "w-full py-2 border-b border-[#c6c6cd]/50"
                  }`}
                >
                  <GripHorizontal size={14} />
                </div>

                {dockPosition === "top" || dockPosition === "bottom" ? (
                  // Horizontal layout
                  <div className="flex items-center gap-0.5">
                    {NAV_ITEMS.map(({ label, icon: Icon }) => (
                      <button
                        key={label}
                        onClick={() => setActiveTab(label)}
                        className={`flex items-center gap-2 px-3 py-2 rounded text-[13px] font-medium transition-colors whitespace-nowrap ${
                          label === activeTab
                            ? "bg-[#eff4ff] text-[#006398]"
                            : "text-[#45464d] hover:bg-[#f8f9ff] hover:text-[#0b1c30]"
                        }`}
                      >
                        <Icon size={14} className="shrink-0" />
                        {label}
                      </button>
                    ))}
                  </div>
                ) : (
                  // Vertical layout — full height sidebar
                  <nav className="flex flex-col w-52">
                    {NAV_ITEMS.map(({ label, icon: Icon }) => (
                      <button
                        key={label}
                        onClick={() => setActiveTab(label)}
                        className={`w-full text-left px-4 py-3 text-[13px] font-medium transition-colors border-b border-[#c6c6cd]/50 last:border-0 flex items-center gap-2.5 ${
                          label === activeTab
                            ? "bg-[#eff4ff] text-[#006398]"
                            : "text-[#45464d] hover:bg-[#f8f9ff] hover:text-[#0b1c30]"
                        }`}
                      >
                        <Icon size={14} className="shrink-0" />
                        {label}
                      </button>
                    ))}
                  </nav>
                )}
              </div>

              {/* ── Scrollable content ── */}
              <main className={`flex-1 overflow-y-auto p-6 ${dockPosition === "left" ? "pl-2" : "pl-6"}`}>
              {activeTab === "Details" && (
                <div className="space-y-5">
                  {/* ── Financial Summary ── */}
                  <section>
                    <h2 className="text-[15px] font-semibold text-[#0b1c30] mb-4">
                      Financial Summary
                    </h2>
                    <div className="flex divide-x divide-[#c6c6cd]">
                      <div className="pr-12">
                        <p className={`${labelCls} mb-1.5`}>
                          TOTAL OUTSTANDING
                        </p>
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

                  {/* ── Three column cards ── */}
                  <div className="grid grid-cols-3 gap-4">
                    {/* ── Column 1: Contact Information ── */}
                    <div className="bg-white rounded-lg border border-[#c6c6cd] shadow-[0px_1px_2px_rgba(15,23,42,0.05)] p-5 flex flex-col">
                      <h3 className="text-[15px] font-semibold text-[#0b1c30] mb-3">
                        Contact Information
                      </h3>
                      <div className="flex flex-col flex-1">
                        {[
                          {
                            label: "Contact Person",
                            value: customer.contact || "—",
                            icons: ["phone"] as const,
                          },
                          {
                            label: "Phone",
                            value: customer.phone || "—",
                            icons: ["phone"] as const,
                          },
                          {
                            label: "Fax",
                            value: customer.fax || "—",
                            icons: ["phone"] as const,
                          },
                          {
                            label: "Email",
                            value: customer.eMail?.trim() || "—",
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

                    {/* ── Column 2: Financial & Admin ── */}
                    <div className="bg-white rounded-lg border border-[#c6c6cd] shadow-[0px_1px_2px_rgba(15,23,42,0.05)] p-5 flex flex-col">
                      <h3 className="text-[15px] font-semibold text-[#0b1c30] mb-4">
                        Financial & Admin
                      </h3>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-5 mb-6">
                        <div>
                          <p className={`${labelCls} mb-1`}>VAT Number</p>
                          <p className="text-[14px] text-[#0b1c30]">
                            {customer.gstNumber || "—"}
                          </p>
                        </div>
                        <div>
                          <p className={`${labelCls} mb-1`}>Credit Limit</p>
                          <p className="text-[14px] text-[#0b1c30]">
                            {customer.creditLimit.toLocaleString("en-ZA", {
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
                              {customer.repCode || "—"}
                            </p>
                          </div>
                          <div>
                            <p className={`${labelCls} mb-1`}>Area Code</p>
                            <p className="text-[14px] text-[#0b1c30]">
                              {customer.category || "—"}
                            </p>
                          </div>
                          <div>
                            <p className={`${labelCls} mb-1`}>Terms</p>
                            <p className="text-[14px] text-[#0b1c30]">
                              30 Days
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Column 3: Internal Notes ── */}
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

                  {/* ── Age Analysis ── */}
                  <section>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-[15px] font-semibold text-[#0b1c30]">
                        Age Analysis
                      </h2>
                      <p className="text-[12px] text-[#76777d]">
                        Account: {customer.accNo}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg border border-[#c6c6cd] shadow-[0px_1px_2px_rgba(15,23,42,0.05)] overflow-hidden">
                      <div className="grid grid-cols-7 divide-x divide-[#c6c6cd] border-b border-[#c6c6cd] bg-[#f8f9ff]">
                        {ageBuckets.map((bucket) => (
                          <div
                            key={bucket.label}
                            className="px-4 py-3 text-center"
                          >
                            <p className={labelCls}>{bucket.label}</p>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 divide-x divide-[#c6c6cd]">
                        {ageBuckets.map((bucket, i) => (
                          <div
                            key={bucket.label}
                            className="px-4 py-4 text-center"
                          >
                            <p
                              className={`text-[13px] font-semibold ${
                                i > 0 && bucket.value > 0
                                  ? "text-[#ba1a1a]"
                                  : "text-[#0b1c30]"
                              }`}
                            >
                              {bucket.value.toLocaleString("en-ZA", {
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                  {/* ── Back button ── */}
                  <div className="flex justify-start pt-2 pb-1">
                    <button
                      onClick={() => router.push("/Finance?view=Clients")}
                      className="h-8 px-4 rounded border border-[#c6c6cd] bg-white text-[#0b1c30] text-sm font-medium flex items-center gap-1.5 hover:bg-[#f8f9ff] transition-colors"
                    >
                      <ArrowLeft size={14} /> Back to Clients
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "Transactions" && (
                <div className="space-y-5">
                  {/* ── Transaction Summary ── */}
                  <section>
                    <h2 className="text-[15px] font-semibold text-[#0b1c30] mb-4">
                      Transactions
                    </h2>
                    <div className="flex divide-x divide-[#c6c6cd]">
                      <div className="pr-12">
                        <p className={`${labelCls} mb-1.5`}>TOTAL INVOICED</p>
                        <p className="text-[30px] font-bold text-[#0b1c30] leading-none">
                          {transactionsLoading
                            ? "—"
                            : fmt(
                                transactions
                                  .filter((t) => isDebitType(t.tranTypeName))
                                  .reduce((s, t) => s + t.totalValue, 0),
                              )}
                        </p>
                      </div>
                      <div className="px-12">
                        <p className={`${labelCls} mb-1.5`}>TOTAL RECEIVED</p>
                        <p className="text-[30px] font-bold text-[#009668] leading-none">
                          {transactionsLoading
                            ? "—"
                            : fmt(
                                transactions
                                  .filter((t) => isCreditType(t.tranTypeName))
                                  .reduce((s, t) => s + t.totalValue, 0),
                              )}
                        </p>
                      </div>
                      <div className="pl-12">
                        <p className={`${labelCls} mb-1.5`}>NET</p>
                        <p className="text-[30px] font-bold text-[#0b1c30] leading-none">
                          {transactionsLoading
                            ? "—"
                            : fmt(
                                transactions
                                  .filter((t) => isDebitType(t.tranTypeName))
                                  .reduce((s, t) => s + t.totalValue, 0) -
                                  transactions
                                    .filter((t) => isCreditType(t.tranTypeName))
                                    .reduce((s, t) => s + t.totalValue, 0),
                              )}
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* ── Filter pills ── */}
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

                  {/* ── Transactions table ── */}
                  {transactionsLoading ? (
                    <div className="bg-white rounded-lg border border-[#c6c6cd] py-16 text-center">
                      <p className="text-sm text-[#76777d]">
                        Loading transactions…
                      </p>
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
                        .filter(
                          (t) =>
                            txFilter === "All" || t.tranTypeName === txFilter,
                        )
                        .map((tx, idx) => {
                          const rowKey = tx.ref + idx;
                          const isExpanded = expandedDoc === rowKey;
                          const canExpand = isExpandable(tx.tranTypeName);
                          const isCredit = isCreditType(tx.tranTypeName);
                          const isDebit = isDebitType(tx.tranTypeName);
                          return (
                            <div
                              key={rowKey}
                              className="border-b border-[#c6c6cd]/50 last:border-0"
                            >
                              {/* Master row */}
                              <button
                                onClick={() => {
                                  if (canExpand) {
                                    if (!isExpanded) fetchLineItems(tx.ref);
                                    setExpandedDoc(isExpanded ? null : rowKey);
                                  }
                                }}
                                className={`w-full grid grid-cols-[28px_110px_185px_1fr_1fr_130px_100px] gap-3 px-4 py-3 text-left transition-colors items-center ${canExpand ? "hover:bg-[#f8f9ff] cursor-pointer" : "cursor-default"}`}
                              >
                                <span className="text-[#76777d] flex items-center">
                                  {canExpand ? (
                                    isExpanded ? (
                                      <ChevronDown size={14} />
                                    ) : (
                                      <ChevronRight size={14} />
                                    )
                                  ) : null}
                                </span>
                                <span className="text-[13px] text-[#45464d]">
                                  {new Date(tx.date).toLocaleDateString(
                                    "en-ZA",
                                    {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    },
                                  )}
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
                                <span className="text-[13px] font-medium text-[#0b1c30] truncate">
                                  {tx.ref || "—"}
                                </span>
                                <span className="text-[13px] text-[#45464d] truncate">
                                  {tx.contraName || tx.notes || "—"}
                                </span>
                                <span
                                  className={`text-[13px] font-semibold text-right ${
                                    isCredit
                                      ? "text-[#009668]"
                                      : "text-[#0b1c30]"
                                  }`}
                                >
                                  {isCredit ? "− " : ""}
                                  {fmt(tx.totalValue)}
                                </span>
                                <span>
                                  {tx.statusName ? (
                                    <span
                                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                        /paid|closed|settled/i.test(
                                          tx.statusName,
                                        )
                                          ? "bg-[#009668]/10 text-[#009668] border-[#009668]/20"
                                          : /open|outstanding/i.test(
                                                tx.statusName,
                                              )
                                            ? "bg-[#F59E0B]/10 text-[#b45309] border-[#F59E0B]/30"
                                            : "bg-[#f8f9ff] text-[#45464d] border-[#c6c6cd]"
                                      }`}
                                    >
                                      {tx.statusName}
                                    </span>
                                  ) : (
                                    <span className="text-[13px] text-[#b0b1b8]">
                                      —
                                    </span>
                                  )}
                                </span>
                              </button>

                              {/* Expanded line items (invoices & credit notes only) */}
                              {isExpanded && canExpand && (
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
                                          <th
                                            className={`${labelCls} text-left pb-2`}
                                          >
                                            Stock Code
                                          </th>
                                          <th
                                            className={`${labelCls} text-left pb-2`}
                                          >
                                            Description
                                          </th>
                                          <th
                                            className={`${labelCls} text-right pb-2`}
                                          >
                                            Qty
                                          </th>
                                          <th
                                            className={`${labelCls} text-right pb-2`}
                                          >
                                            Unit Price
                                          </th>
                                          <th
                                            className={`${labelCls} text-right pb-2`}
                                          >
                                            Disc%
                                          </th>
                                          <th
                                            className={`${labelCls} text-right pb-2`}
                                          >
                                            Line Total
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(lineItems[tx.ref] ?? []).map(
                                          (line, li) => (
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
                                          ),
                                        )}
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

                  {/* ── Back button ── */}
                  <div className="flex justify-start pt-2 pb-1">
                    <button
                      onClick={() => router.push("/Finance?view=Clients")}
                      className="h-8 px-4 rounded border border-[#c6c6cd] bg-white text-[#0b1c30] text-sm font-medium flex items-center gap-1.5 hover:bg-[#f8f9ff] transition-colors"
                    >
                      <ArrowLeft size={14} /> Back to Clients
                    </button>
                  </div>
                </div>
              )}
              </main>

              {/* ── Drag overlay: drop zones + floating clone ── */}
              {isDragging && (
                <>
                  {(["left", "right", "top", "bottom"] as const).map((zone) => (
                    <div
                      key={zone}
                      style={zone === "left" ? { left: isExpanded ? 192 : 56 } : undefined}
                      className={`fixed z-40 pointer-events-none flex items-center justify-center transition-colors ${
                        zone === "left"   ? "top-0 h-full w-24" :
                        zone === "right"  ? "right-0 top-0 h-full w-24" :
                        zone === "top"    ? "top-0 left-0 w-full h-24" :
                                            "bottom-0 left-0 w-full h-24"
                      } ${snapTarget === zone ? "bg-[#006398]/50" : "bg-[#006398]/25"}`}
                    >
                      <div className={`rounded-full transition-all ${
                        snapTarget === zone ? "bg-[#006398] scale-125" : "bg-[#006398]/70"
                      } ${zone === "left" || zone === "right" ? "w-1.5 h-16" : "w-16 h-1.5"}`} />
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
                        <span className="text-[11px] font-semibold text-[#76777d] uppercase tracking-wide">Navigation</span>
                      </div>
                      {NAV_ITEMS.map(({ label, icon: Icon }) => (
                        <button
                          key={label}
                          className={`w-full text-left px-4 py-2.5 text-[13px] font-medium border-b border-[#c6c6cd]/50 last:border-0 flex items-center gap-2.5 ${
                            label === activeTab ? "bg-[#eff4ff] text-[#006398]" : "text-[#45464d]"
                          }`}
                        >
                          <Icon size={14} className="shrink-0" />
                          {label}
                        </button>
                      ))}
                    </nav>
                  </div>
                </>
              )}
            </div>

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

// ── Previous widget-based implementation (preserved for reference) ────────────

// import { useState, useEffect, useCallback } from "react";
// import { useParams, useRouter } from "next/navigation";
// import { ResponsiveGridLayout, useContainerWidth } from "react-grid-layout";
// import type { ResponsiveLayouts } from "react-grid-layout";
// import {
//   User,
//   MessageCircle,
//   Phone,
//   Mail,
//   MapPin,
//   Bold,
//   Italic,
//   Underline,
//   Strikethrough,
//   List,
//   ListOrdered,
//   X,
//   GripHorizontal,
//   LayoutDashboard,
//   Download,
//   Edit3,
//   Plus,
//   RotateCcw,
// } from "lucide-react";
// import FinanceSidebar from "@/app/Finance/components/financeSidebar";

// // ── Design tokens ────────────────────────────────────────────────────────────
// // surface: #f8f9ff  |  on-surface: #0b1c30  |  on-surface-variant: #45464d
// // outline-variant: #c6c6cd  |  outline: #76777d
// // secondary (sky blue): #006398  |  tertiary (green): #009668
// // error: #ba1a1a  |  primary-container: #131b2e  |  inverse-surface: #213145
// // micro-depth: 0px 1px 2px rgba(15,23,42,.05)
// // soft-lift:   0px 4px 12px rgba(15,23,42,.08)

// interface Customer {
//   accNo: string;
//   name: string;
//   address1: string;
//   address2: string;
//   address3: string;
//   address4: string;
//   phone: string;
//   fax: string;
//   eMail: string;
//   contact: string;
//   repCode: string;
//   category: string;
//   gstNumber: string;
//   creditLimit: number;
//   balance: number;
//   activeYN: boolean;
// }

// const MOCK_ACTIVITY = [
//   { date: "Oct 24, 2024", type: "INVOICE" as const, amount: 12500 },
//   { date: "Oct 20, 2024", type: "PAYMENT" as const, amount: -5000 },
//   { date: "Oct 15, 2024", type: "CREDIT" as const, amount: 2100 },
//   { date: "Oct 10, 2024", type: "INVOICE" as const, amount: 8400 },
// ];

// const WIDGET_META: Record<string, { title: string }> = {
//   contact: { title: "Contact Information" },
//   map: { title: "Map Location" },
//   finAdmin: { title: "Financial & Admin" },
//   notes: { title: "Internal Notes" },
//   activity: { title: "Recent Activity" },
//   ageAnalysis: { title: "Age Analysis" },
// };

// const DEFAULT_VISIBLE_WIDGETS = [
//   "contact",
//   "map",
//   "finAdmin",
//   "notes",
//   "activity",
//   "ageAnalysis",
// ];

// const DEFAULT_LAYOUTS: ResponsiveLayouts = {
//   lg: [
//     { i: "contact", x: 0, y: 0, w: 7, h: 6, minW: 3, minH: 3 },
//     { i: "map", x: 7, y: 0, w: 5, h: 3, minW: 2, minH: 2 },
//     { i: "finAdmin", x: 7, y: 3, w: 5, h: 6, minW: 3, minH: 3 },
//     { i: "notes", x: 0, y: 6, w: 7, h: 5, minW: 3, minH: 3 },
//     { i: "activity", x: 7, y: 9, w: 5, h: 5, minW: 3, minH: 3 },
//     { i: "ageAnalysis", x: 0, y: 11, w: 12, h: 4, minW: 6, minH: 3 },
//   ],
// };

// // ── Shared style constants ───────────────────────────────────────────────────

// const cardCls =
//   "bg-white rounded-lg border border-[#c6c6cd] shadow-[0px_1px_2px_rgba(15,23,42,0.05)]";

// const btnPrimaryCls =
//   "h-8 px-4 rounded bg-[#0b1c30] text-white text-xs font-semibold font-body " +
//   "hover:bg-[#131b2e] transition-colors flex items-center gap-1.5 shrink-0 " +
//   "shadow-[0px_1px_2px_rgba(15,23,42,0.05)]";

// const btnSecondaryCls =
//   "h-8 px-4 rounded border border-[#c6c6cd] bg-white text-[#0b1c30] text-xs font-medium font-body " +
//   "hover:bg-[#f8f9ff] hover:border-[#5bb8fe] transition-colors flex items-center gap-1.5 shrink-0 " +
//   "shadow-[0px_1px_2px_rgba(15,23,42,0.05)]";

// const labelCls =
//   "text-[11px] font-semibold uppercase tracking-[0.05em] text-[#45464d] font-body";

// // ── Widget card shell ────────────────────────────────────────────────────────

// function WidgetCard({
//   id,
//   title,
//   onRemove,
//   children,
//   headerExtra,
// }: {
//   id: string;
//   title: string;
//   onRemove: (id: string) => void;
//   children: React.ReactNode;
//   headerExtra?: React.ReactNode;
// }) {
//   return (
//     <div
//       className={`${cardCls} flex flex-col h-full overflow-hidden select-none`}
//     >
//       <div className="widget-drag-handle flex items-center justify-between px-4 py-2.5 border-b border-[#c6c6cd] cursor-grab active:cursor-grabbing shrink-0">
//         <div className="flex items-center gap-2">
//           <GripHorizontal size={13} className="text-[#c6c6cd]" />
//           <span className="font-display text-[15px] font-semibold text-[#0b1c30]">
//             {title}
//           </span>
//         </div>
//         <div className="flex items-center gap-1">
//           {headerExtra}
//           <button
//             className="w-5 h-5 rounded flex items-center justify-center text-[#c6c6cd] hover:text-[#ba1a1a] hover:bg-[#ba1a1a]/8 transition-colors"
//             title="Remove widget"
//             onMouseDown={(e) => e.stopPropagation()}
//             onClick={() => onRemove(id)}
//           >
//             <X size={12} />
//           </button>
//         </div>
//       </div>
//       <div className="flex-1 overflow-auto">{children}</div>
//     </div>
//   );
// }

// // ── Widget contents ──────────────────────────────────────────────────────────

// function ContactWidget({ customer }: { customer: Customer }) {
//   const rows = [
//     { label: "Switchboard", value: null, icon: Phone },
//     { label: "Accounts Department", value: null, icon: Phone },
//     { label: "Procurement", value: null, icon: Phone },
//     { label: "Cell Phone", value: customer.phone, icon: Phone },
//     { label: "Fax", value: customer.fax, icon: Phone },
//   ].filter((r) => r.value !== undefined);

//   return (
//     <div className="px-4 py-1 h-full overflow-auto font-body">
//       {rows.map(({ label, value, icon: Icon }) => (
//         <div
//           key={label}
//           className="flex items-center justify-between py-2.5 border-b border-[#c6c6cd]/40 last:border-0"
//         >
//           <div>
//             <p className={`${labelCls} mb-0.5`}>{label}</p>
//             <p className="text-[14px] text-[#0b1c30]">{value || "—"}</p>
//           </div>
//           <button className="w-7 h-7 rounded border border-[#c6c6cd]/60 bg-white hover:border-[#5bb8fe] hover:text-[#006398] flex items-center justify-center text-[#76777d] transition-colors">
//             <Icon size={12} />
//           </button>
//         </div>
//       ))}
//       {customer.eMail && (
//         <div className="flex items-center justify-between py-2.5">
//           <div>
//             <p className={`${labelCls} mb-0.5`}>Email</p>
//             <p className="text-[14px] text-[#0b1c30]">
//               {customer.eMail.trim()}
//             </p>
//           </div>
//           <button className="w-7 h-7 rounded border border-[#c6c6cd]/60 bg-white hover:border-[#5bb8fe] hover:text-[#006398] flex items-center justify-center text-[#76777d] transition-colors">
//             <Mail size={12} />
//           </button>
//         </div>
//       )}
//     </div>
//   );
// }

// function MapWidget({ customer }: { customer: Customer }) {
//   const city =
//     [customer.address3, customer.address4].filter(Boolean).join(", ") ||
//     "Location not set";

//   return (
//     <div className="h-full flex flex-col">
//       <div className="flex-1 relative overflow-hidden bg-[#16202e]">
//         <svg
//           className="absolute inset-0 w-full h-full"
//           viewBox="0 0 300 160"
//           preserveAspectRatio="xMidYMid slice"
//         >
//           <line x1="0" y1="55" x2="300" y2="55" stroke="#1e2d40" strokeWidth="9" />
//           <line x1="0" y1="110" x2="300" y2="110" stroke="#1e2d40" strokeWidth="5" />
//           <line x1="70" y1="0" x2="70" y2="160" stroke="#1e2d40" strokeWidth="11" />
//           <line x1="170" y1="0" x2="170" y2="160" stroke="#1e2d40" strokeWidth="7" />
//           <line x1="240" y1="0" x2="240" y2="160" stroke="#1e2d40" strokeWidth="4" />
//           <line x1="0" y1="30" x2="300" y2="30" stroke="#1b2738" strokeWidth="2" />
//           <line x1="0" y1="80" x2="300" y2="80" stroke="#1b2738" strokeWidth="2" />
//           <line x1="0" y1="135" x2="300" y2="135" stroke="#1b2738" strokeWidth="2" />
//           <line x1="120" y1="0" x2="120" y2="160" stroke="#1b2738" strokeWidth="2" />
//           <line x1="200" y1="0" x2="200" y2="160" stroke="#1b2738" strokeWidth="2" />
//           <line x1="260" y1="0" x2="260" y2="160" stroke="#1b2738" strokeWidth="2" />
//           <rect x="75" y="60" width="90" height="45" fill="#1a2838" rx="1" />
//           <rect x="175" y="60" width="60" height="45" fill="#1a2838" rx="1" />
//           <rect x="0" y="60" width="65" height="45" fill="#1a2838" rx="1" />
//           <rect x="0" y="115" width="65" height="40" fill="#1a2838" rx="1" />
//           <rect x="75" y="115" width="90" height="40" fill="#1a2838" rx="1" />
//           <rect x="245" y="60" width="55" height="45" fill="#1a2838" rx="1" />
//         </svg>
//         <div className="absolute inset-0 flex items-center justify-center">
//           <div className="flex flex-col items-center">
//             <div className="w-3.5 h-3.5 rounded-full bg-[#5bb8fe] ring-[6px] ring-[#5bb8fe]/20 shadow-lg shadow-[#5bb8fe]/40" />
//             <div className="w-0.5 h-3 bg-[#5bb8fe]/50 mt-0.5" />
//           </div>
//         </div>
//       </div>
//       <div className="px-4 py-2.5 flex items-center gap-2 border-t border-[#c6c6cd]">
//         <MapPin size={12} className="text-[#76777d] shrink-0" />
//         <p className="font-body text-[13px] text-[#45464d]">{city}</p>
//       </div>
//     </div>
//   );
// }

// function FinancialAdminWidget({ customer }: { customer: Customer }) {
//   return (
//     <div className="px-4 py-3 h-full overflow-auto font-body">
//       <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-4">
//         <div>
//           <p className={`${labelCls} mb-1`}>VAT Number</p>
//           <p className="text-[14px] text-[#0b1c30]">
//             {customer.gstNumber || "—"}
//           </p>
//         </div>
//         <div>
//           <p className={`${labelCls} mb-1`}>Credit Limit</p>
//           <p className="font-data text-[14px] text-[#0b1c30]">
//             R{" "}
//             {customer.creditLimit.toLocaleString("en-ZA", {
//               minimumFractionDigits: 2,
//             })}
//           </p>
//         </div>
//         <div>
//           <p className={`${labelCls} mb-1`}>Trade Discount</p>
//           <p className="text-[14px] text-[#0b1c30]">—</p>
//         </div>
//         <div>
//           <p className={`${labelCls} mb-1`}>Tax Status</p>
//           <span className="inline-flex items-center text-[11px] font-semibold text-[#009668] bg-[#009668]/10 border border-[#009668]/20 px-2 py-0.5 rounded-xl">
//             Compliant
//           </span>
//         </div>
//       </div>

//       <div className="border-t border-[#c6c6cd]/40 pt-3">
//         <p className={`${labelCls} mb-3 text-[#76777d]`}>Classification</p>
//         <div className="grid grid-cols-3 gap-x-4 gap-y-3">
//           <div>
//             <p className={`${labelCls} mb-1`}>Rep Code</p>
//             <p className="text-[14px] text-[#0b1c30]">
//               {customer.repCode || "—"}
//             </p>
//           </div>
//           <div>
//             <p className={`${labelCls} mb-1`}>Area Code</p>
//             <p className="text-[14px] text-[#0b1c30]">
//               {customer.category || "—"}
//             </p>
//           </div>
//           <div>
//             <p className={`${labelCls} mb-1`}>Terms</p>
//             <p className="text-[14px] text-[#0b1c30]">30 Days</p>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// function NotesWidget() {
//   return (
//     <div className="p-3 h-full flex flex-col font-body">
//       <div className="flex items-center gap-0.5 pb-2 mb-2 border-b border-[#c6c6cd]/40 shrink-0">
//         {[
//           { Icon: Bold, label: "Bold" },
//           { Icon: Italic, label: "Italic" },
//           { Icon: Underline, label: "Underline" },
//           { Icon: Strikethrough, label: "Strikethrough" },
//         ].map(({ Icon, label }) => (
//           <button
//             key={label}
//             title={label}
//             className="w-6 h-6 rounded flex items-center justify-center text-[#45464d] hover:bg-[#eff4ff] hover:text-[#006398] transition-colors"
//           >
//             <Icon size={12} />
//           </button>
//         ))}
//         <div className="w-px h-4 bg-[#c6c6cd] mx-1" />
//         {[
//           { Icon: List, label: "Bullet list" },
//           { Icon: ListOrdered, label: "Numbered list" },
//         ].map(({ Icon, label }) => (
//           <button
//             key={label}
//             title={label}
//             className="w-6 h-6 rounded flex items-center justify-center text-[#45464d] hover:bg-[#eff4ff] hover:text-[#006398] transition-colors"
//           >
//             <Icon size={12} />
//           </button>
//         ))}
//       </div>
//       <textarea
//         className="flex-1 resize-none text-[14px] text-[#0b1c30] placeholder:text-[#76777d] focus:outline-none leading-relaxed"
//         placeholder="Add notes about this client…"
//       />
//     </div>
//   );
// }

// function ActivityWidget() {
//   const typeCls: Record<string, string> = {
//     INVOICE: "bg-[#eff4ff] text-[#006398] border border-[#c6c6cd]/60",
//     PAYMENT: "bg-[#009668]/10 text-[#009668] border border-[#009668]/20",
//     CREDIT: "bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20",
//   };

//   return (
//     <div className="px-4 py-3 h-full flex flex-col font-body">
//       <div className="flex items-center justify-between mb-3 shrink-0">
//         <p className={labelCls}>Latest transactions</p>
//         <button className="text-[12px] font-medium text-[#006398] hover:underline underline-offset-2">
//           View All →
//         </button>
//       </div>
//       <div className="flex-1 overflow-auto">
//         <table className="w-full">
//           <thead>
//             <tr className="border-b border-[#c6c6cd]/40">
//               <th className={`${labelCls} text-left pb-2 font-semibold`}>Date</th>
//               <th className={`${labelCls} text-left pb-2 font-semibold`}>Type</th>
//               <th className={`${labelCls} text-right pb-2 font-semibold`}>Amount</th>
//             </tr>
//           </thead>
//           <tbody>
//             {MOCK_ACTIVITY.map((row, i) => (
//               <tr
//                 key={i}
//                 className={`border-b border-[#c6c6cd]/30 last:border-0 ${i % 2 === 1 ? "bg-[#f8f9ff]" : "bg-white"}`}
//               >
//                 <td className="py-2.5 text-[13px] text-[#45464d]">{row.date}</td>
//                 <td className="py-2.5">
//                   <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-xl ${typeCls[row.type]}`}>
//                     {row.type}
//                   </span>
//                 </td>
//                 <td className={`py-2.5 text-right font-data text-[13px] ${row.amount < 0 ? "text-[#009668]" : "text-[#0b1c30]"}`}>
//                   {row.amount < 0 ? "− " : ""}R{" "}
//                   {Math.abs(row.amount).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );
// }

// function AgeAnalysisWidget({ customer }: { customer: Customer }) {
//   void customer;

//   const asOfDate = "Oct 24, 2024";
//   const buckets = [
//     { label: "Current", amount: 120340.0 },
//     { label: "30 Days", amount: 4200.0 },
//     { label: "60 Days", amount: 0 },
//     { label: "90 Days", amount: 0 },
//     { label: "120 Days", amount: 0 },
//     { label: "150 Days", amount: 0 },
//     { label: "180+ Days", amount: 0 },
//   ];

//   const total = buckets.reduce((sum, b) => sum + b.amount, 0);

//   const formatAmount = (n: number) =>
//     n.toLocaleString("en-ZA", { minimumFractionDigits: 2 });

//   return (
//     <div className="px-4 py-3 h-full flex flex-col font-body">
//       <div className="flex items-center justify-between mb-3 shrink-0">
//         <p className={labelCls}>Ageing buckets</p>
//         <p className="font-body text-[12px] text-[#76777d]">As of {asOfDate}</p>
//       </div>
//       <div className="grid grid-cols-7 gap-2 mb-3">
//         {buckets.map((b) => {
//           const isOverdue = b.label !== "Current" && b.amount > 0;
//           return (
//             <div key={b.label} className="border border-[#c6c6cd] rounded p-2 bg-white flex flex-col">
//               <p className={`${labelCls} mb-1 text-[10px]`}>{b.label}</p>
//               <p className={`font-data text-[13px] font-semibold ${isOverdue ? "text-[#ba1a1a]" : "text-[#0b1c30]"}`}>
//                 R {formatAmount(b.amount)}
//               </p>
//             </div>
//           );
//         })}
//       </div>
//       <div className="flex items-center justify-between border-t border-[#c6c6cd] pt-2.5 mt-auto shrink-0">
//         <p className={labelCls}>Total Outstanding Balance</p>
//         <p className="font-data text-[14px] font-bold text-[#0b1c30]">
//           R {formatAmount(total)}
//         </p>
//       </div>
//     </div>
//   );
// }

// // ── Main page ────────────────────────────────────────────────────────────────

// export default function ClientDetailPage() {
//   const params = useParams();
//   const router = useRouter();
//   const accNo = params.accNo as string;

//   const [activeNavItem, setActiveNavItem] = useState("Clients");
//   const [isExpanded, setIsExpanded] = useState(false);
//   const [customer, setCustomer] = useState<Customer | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   const { width, containerRef, mounted } = useContainerWidth();
//   const [showCustomize, setShowCustomize] = useState(false);
//   const [visibleWidgets, setVisibleWidgets] = useState<Set<string>>(
//     () => new Set(DEFAULT_VISIBLE_WIDGETS),
//   );
//   const [layouts, setLayouts] = useState<ResponsiveLayouts>(DEFAULT_LAYOUTS);

//   useEffect(() => {
//     if (!accNo) return;
//     try {
//       const savedLayout = localStorage.getItem(`layout:${accNo}`);
//       if (savedLayout) setLayouts(JSON.parse(savedLayout));
//       const savedWidgets = localStorage.getItem(`widgets:${accNo}`);
//       if (savedWidgets) setVisibleWidgets(new Set(JSON.parse(savedWidgets)));
//     } catch {}
//   }, [accNo]);

//   useEffect(() => {
//     const stored = localStorage.getItem("selectedCompany");
//     if (!stored) return;
//     let company: { companyNr: string };
//     try {
//       company = JSON.parse(stored);
//     } catch {
//       setError("Could not read company data.");
//       setLoading(false);
//       return;
//     }
//     (async () => {
//       try {
//         const res = await fetch(
//           `/api/customers/customer?companyNr=${company.companyNr}&accNo=${accNo}`,
//         );
//         const result = await res.json();
//         const data = result?.data?.data?.customer;
//         if (result.success && data) {
//           setCustomer(data);
//         } else {
//           setError("Customer not found.");
//         }
//       } catch {
//         setError("Failed to load customer.");
//       } finally {
//         setLoading(false);
//       }
//     })();
//   }, [accNo]);

//   const handleLayoutChange = useCallback(
//     (_: unknown, allLayouts: ResponsiveLayouts) => {
//       setLayouts(allLayouts);
//       try {
//         localStorage.setItem(`layout:${accNo}`, JSON.stringify(allLayouts));
//       } catch {}
//     },
//     [accNo],
//   );

//   const removeWidget = useCallback(
//     (id: string) => {
//       setVisibleWidgets((prev) => {
//         const next = new Set(prev);
//         next.delete(id);
//         try {
//           localStorage.setItem(`widgets:${accNo}`, JSON.stringify([...next]));
//         } catch {}
//         return next;
//       });
//     },
//     [accNo],
//   );

//   const toggleWidget = useCallback(
//     (id: string) => {
//       setVisibleWidgets((prev) => {
//         const next = new Set(prev);
//         if (next.has(id)) next.delete(id);
//         else next.add(id);
//         try {
//           localStorage.setItem(`widgets:${accNo}`, JSON.stringify([...next]));
//         } catch {}
//         return next;
//       });
//     },
//     [accNo],
//   );

//   const resetLayout = useCallback(() => {
//     setLayouts(DEFAULT_LAYOUTS);
//     setVisibleWidgets(new Set(DEFAULT_VISIBLE_WIDGETS));
//     try {
//       localStorage.removeItem(`layout:${accNo}`);
//       localStorage.removeItem(`widgets:${accNo}`);
//     } catch {}
//   }, [accNo]);

//   const initials =
//     customer?.name
//       .split(" ")
//       .slice(0, 2)
//       .map((w) => w[0])
//       .join("")
//       .toUpperCase() ?? "?";

//   const totalOutstanding = customer?.balance ?? 0;
//   const creditAvailable = Math.max(
//     0,
//     (customer?.creditLimit ?? 0) - (customer?.balance ?? 0),
//   );

//   const filteredLayout = {
//     lg: (layouts.lg ?? DEFAULT_LAYOUTS.lg!).filter((l) =>
//       visibleWidgets.has(l.i),
//     ),
//   };

//   return (
//     <div className="flex flex-col h-screen bg-[#f8f9ff] font-body">
//       <div className="flex flex-1 overflow-hidden">
//         <FinanceSidebar
//           isExpanded={isExpanded}
//           setIsExpanded={setIsExpanded}
//           activeItem={activeNavItem}
//           setActiveItem={setActiveNavItem}
//         />

//         <div className="flex flex-col flex-1 overflow-hidden">
//           {/* ── App header ── */}
//           <header className="h-12 bg-white border-b border-[#c6c6cd] flex items-center justify-between px-4 shrink-0 shadow-[0px_1px_2px_rgba(15,23,42,0.05)]">
//             <div className="flex items-center gap-3">
//               <div className="w-8 h-8 rounded bg-[#0b1c30] flex items-center justify-center shrink-0">
//                 <span className="text-white text-[9px] font-semibold tracking-widest font-body">
//                   GEN
//                 </span>
//               </div>
//               <p className="font-body text-sm text-[#45464d]">
//                 Revelation Suite —{" "}
//                 <span className="font-semibold text-[#0b1c30] tracking-wide">
//                   FINANCE
//                 </span>
//               </p>
//             </div>
//             <div className="flex items-center gap-1">
//               <button className="w-8 h-8 rounded flex items-center justify-center text-[#76777d] hover:text-[#0b1c30] hover:bg-[#eff4ff] transition-colors">
//                 <User size={16} />
//               </button>
//               <button className="w-8 h-8 rounded flex items-center justify-center text-[#76777d] hover:text-[#0b1c30] hover:bg-[#eff4ff] transition-colors">
//                 <MessageCircle size={16} />
//               </button>
//             </div>
//           </header>

//           {/* ── Scrollable body ── */}
//           <main className="flex-1 overflow-y-auto">
//             <div className="p-5 space-y-4">
//               {loading && (
//                 <div className="flex items-center justify-center py-20">
//                   <p className="font-body text-sm text-[#76777d]">Loading client…</p>
//                 </div>
//               )}
//               {error && (
//                 <div className="flex items-center justify-center py-20">
//                   <p className="font-body text-sm text-[#ba1a1a]">{error}</p>
//                 </div>
//               )}

//               {customer && (
//                 <>
//                   {/* ── Client header card ── */}
//                   <div className={`${cardCls} px-5 py-4 flex items-center justify-between`}>
//                     <div className="flex items-center gap-4">
//                       <div className="w-10 h-10 rounded-lg bg-[#131b2e] flex items-center justify-center shrink-0">
//                         <span className="font-display text-white text-sm font-semibold">
//                           {initials}
//                         </span>
//                       </div>
//                       <div>
//                         <div className="flex items-center gap-2.5 flex-wrap">
//                           <h1 className="font-display text-[20px] font-semibold leading-7 text-[#0b1c30]">
//                             {customer.name}
//                           </h1>
//                           {customer.category && (
//                             <span className="font-body text-[14px] text-[#45464d]">
//                               ({customer.category})
//                             </span>
//                           )}
//                           <span
//                             className={`font-body text-[11px] font-semibold px-2.5 py-0.5 rounded-xl border ${
//                               customer.activeYN
//                                 ? "bg-[#009668]/10 text-[#009668] border-[#009668]/25"
//                                 : "bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/25"
//                             }`}
//                           >
//                             {customer.activeYN ? "Active" : "Inactive"}
//                           </span>
//                         </div>
//                         {customer.eMail?.trim() && (
//                           <p className="font-body text-[13px] text-[#45464d] mt-0.5">
//                             {customer.eMail.trim()}
//                           </p>
//                         )}
//                       </div>
//                     </div>

//                     <div className="flex items-center gap-2 shrink-0">
//                       <button className={btnSecondaryCls}>
//                         <Download size={13} /> Export
//                       </button>
//                       <button className={btnSecondaryCls}>
//                         <Edit3 size={13} /> Edit Client
//                       </button>
//                       <button className={btnPrimaryCls}>
//                         <Plus size={13} /> New Entry
//                       </button>
//                     </div>
//                   </div>

//                   {/* ── KPI banner ── */}
//                   <div className={`${cardCls} px-5 py-4 grid grid-cols-3 divide-x divide-[#c6c6cd]`}>
//                     <div className="pr-8">
//                       <p className={`${labelCls} mb-1.5`}>Total Outstanding</p>
//                       <p className="font-data text-[20px] font-bold text-[#0b1c30]">
//                         R{" "}
//                         {totalOutstanding.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
//                       </p>
//                     </div>
//                     <div className="px-8">
//                       <p className={`${labelCls} mb-1.5`}>Overdue</p>
//                       <p className="font-data text-[20px] font-bold text-[#ba1a1a]">R 0.00</p>
//                     </div>
//                     <div className="pl-8">
//                       <p className={`${labelCls} mb-1.5`}>Credit Available</p>
//                       <p className="font-data text-[20px] font-bold text-[#009668]">
//                         R{" "}
//                         {creditAvailable.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
//                       </p>
//                     </div>
//                   </div>

//                   {/* ── Widget toolbar ── */}
//                   <div className="flex items-center justify-between">
//                     <p className="font-body text-[13px] text-[#76777d]">
//                       Drag widgets to rearrange · Resize from the corner
//                     </p>
//                     <div className="flex items-center gap-2 relative">
//                       <button
//                         onClick={resetLayout}
//                         className={`${btnSecondaryCls} h-7 px-3 text-[12px]`}
//                         title="Reset layout"
//                       >
//                         <RotateCcw size={12} /> Reset
//                       </button>
//                       <button
//                         onClick={() => setShowCustomize((v) => !v)}
//                         className={`h-7 px-3 rounded border text-[12px] font-medium font-body flex items-center gap-1.5 transition-colors shadow-[0px_1px_2px_rgba(15,23,42,0.05)] ${
//                           showCustomize
//                             ? "bg-[#0b1c30] text-white border-[#0b1c30]"
//                             : "bg-white border-[#c6c6cd] text-[#0b1c30] hover:bg-[#f8f9ff] hover:border-[#5bb8fe]"
//                         }`}
//                       >
//                         <LayoutDashboard size={12} /> Customise
//                       </button>

//                       {/* Customise dropdown */}
//                       {showCustomize && (
//                         <div className="absolute right-0 top-9 z-50 w-56 bg-white rounded-lg border border-[#c6c6cd] shadow-[0px_4px_12px_rgba(15,23,42,0.08)] p-2">
//                           <p className={`${labelCls} px-2 py-1.5`}>Toggle Widgets</p>
//                           {Object.entries(WIDGET_META).map(([id, meta]) => (
//                             <button
//                               key={id}
//                               onClick={() => toggleWidget(id)}
//                               className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-[#eff4ff] transition-colors text-left"
//                             >
//                               <span className="font-body text-[13px] text-[#0b1c30]">
//                                 {meta.title}
//                               </span>
//                               <div
//                                 className={`w-8 h-[18px] rounded-full transition-colors relative flex-shrink-0 ${
//                                   visibleWidgets.has(id) ? "bg-[#006398]" : "bg-[#c6c6cd]"
//                                 }`}
//                               >
//                                 <div
//                                   className={`absolute top-[3px] w-3 h-3 rounded-full bg-white shadow-sm transition-all ${
//                                     visibleWidgets.has(id) ? "left-[17px]" : "left-[3px]"
//                                   }`}
//                                 />
//                               </div>
//                             </button>
//                           ))}
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                 </>
//               )}

//               {/* ── Widget grid (ref container is always mounted) ── */}
//               <div
//                 ref={containerRef}
//                 onClick={() => showCustomize && setShowCustomize(false)}
//               >
//                 {mounted && customer && (
//                   <ResponsiveGridLayout
//                     className="layout"
//                     width={width}
//                     layouts={filteredLayout}
//                     breakpoints={{ lg: 1200, md: 768 }}
//                     cols={{ lg: 12, md: 10 }}
//                     rowHeight={50}
//                     margin={[12, 12]}
//                     containerPadding={[0, 0]}
//                     dragConfig={{ handle: ".widget-drag-handle" }}
//                     onLayoutChange={handleLayoutChange}
//                     resizeConfig={{ handles: ["se"] }}
//                   >
//                     {visibleWidgets.has("contact") && (
//                       <div key="contact">
//                         <WidgetCard id="contact" title="Contact Information" onRemove={removeWidget}>
//                           <ContactWidget customer={customer} />
//                         </WidgetCard>
//                       </div>
//                     )}
//                     {visibleWidgets.has("map") && (
//                       <div key="map">
//                         <WidgetCard id="map" title="Map Location" onRemove={removeWidget}>
//                           <MapWidget customer={customer} />
//                         </WidgetCard>
//                       </div>
//                     )}
//                     {visibleWidgets.has("finAdmin") && (
//                       <div key="finAdmin">
//                         <WidgetCard id="finAdmin" title="Financial & Admin" onRemove={removeWidget}>
//                           <FinancialAdminWidget customer={customer} />
//                         </WidgetCard>
//                       </div>
//                     )}
//                     {visibleWidgets.has("notes") && (
//                       <div key="notes">
//                         <WidgetCard id="notes" title="Internal Notes" onRemove={removeWidget}>
//                           <NotesWidget />
//                         </WidgetCard>
//                       </div>
//                     )}
//                     {visibleWidgets.has("activity") && (
//                       <div key="activity">
//                         <WidgetCard id="activity" title="Recent Activity" onRemove={removeWidget}>
//                           <ActivityWidget />
//                         </WidgetCard>
//                       </div>
//                     )}
//                     {visibleWidgets.has("ageAnalysis") && (
//                       <div key="ageAnalysis">
//                         <WidgetCard id="ageAnalysis" title="Age Analysis" onRemove={removeWidget}>
//                           <AgeAnalysisWidget customer={customer} />
//                         </WidgetCard>
//                       </div>
//                     )}
//                   </ResponsiveGridLayout>
//                 )}
//               </div>

//               {/* ── Footer ── */}
//               {customer && (
//                 <div className="flex items-center justify-end pb-5">
//                   <button
//                     onClick={() => router.push("/Finance?view=Clients")}
//                     className={btnPrimaryCls}
//                   >
//                     ← Back to Clients
//                   </button>
//                 </div>
//               )}
//             </div>
//           </main>
//         </div>
//       </div>
//     </div>
//   );
// }
