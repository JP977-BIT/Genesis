"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ResponsiveGridLayout, useContainerWidth } from "react-grid-layout";
import type { ResponsiveLayouts } from "react-grid-layout";
import {
  User,
  MessageCircle,
  Phone,
  Mail,
  MapPin,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  X,
  GripHorizontal,
  LayoutDashboard,
  Download,
  Edit3,
  Plus,
  RotateCcw,
} from "lucide-react";
import FinanceSidebar from "@/app/Finance/components/financeSidebar";

// ── Design tokens ────────────────────────────────────────────────────────────
// surface: #f8f9ff  |  on-surface: #0b1c30  |  on-surface-variant: #45464d
// outline-variant: #c6c6cd  |  outline: #76777d
// secondary (sky blue): #006398  |  tertiary (green): #009668
// error: #ba1a1a  |  primary-container: #131b2e  |  inverse-surface: #213145
// micro-depth: 0px 1px 2px rgba(15,23,42,.05)
// soft-lift:   0px 4px 12px rgba(15,23,42,.08)

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

const MOCK_ACTIVITY = [
  { date: "Oct 24, 2024", type: "INVOICE" as const, amount: 12500 },
  { date: "Oct 20, 2024", type: "PAYMENT" as const, amount: -5000 },
  { date: "Oct 15, 2024", type: "CREDIT" as const, amount: 2100 },
  { date: "Oct 10, 2024", type: "INVOICE" as const, amount: 8400 },
];

const WIDGET_META: Record<string, { title: string }> = {
  contact:  { title: "Contact Information" },
  map:      { title: "Map Location" },
  finAdmin: { title: "Financial & Admin" },
  notes:    { title: "Internal Notes" },
  activity: { title: "Recent Activity" },
};

const DEFAULT_LAYOUTS: ResponsiveLayouts = {
  lg: [
    { i: "contact",  x: 0, y: 0, w: 7, h: 6, minW: 3, minH: 3 },
    { i: "map",      x: 7, y: 0, w: 5, h: 3, minW: 2, minH: 2 },
    { i: "finAdmin", x: 7, y: 3, w: 5, h: 6, minW: 3, minH: 3 },
    { i: "notes",    x: 0, y: 6, w: 7, h: 5, minW: 3, minH: 3 },
    { i: "activity", x: 7, y: 9, w: 5, h: 5, minW: 3, minH: 3 },
  ],
};

// ── Shared style constants ───────────────────────────────────────────────────

const cardCls =
  "bg-white rounded-lg border border-[#c6c6cd] shadow-[0px_1px_2px_rgba(15,23,42,0.05)]";

const btnPrimaryCls =
  "h-8 px-4 rounded bg-[#0b1c30] text-white text-xs font-semibold font-body " +
  "hover:bg-[#131b2e] transition-colors flex items-center gap-1.5 shrink-0 " +
  "shadow-[0px_1px_2px_rgba(15,23,42,0.05)]";

const btnSecondaryCls =
  "h-8 px-4 rounded border border-[#c6c6cd] bg-white text-[#0b1c30] text-xs font-medium font-body " +
  "hover:bg-[#f8f9ff] hover:border-[#5bb8fe] transition-colors flex items-center gap-1.5 shrink-0 " +
  "shadow-[0px_1px_2px_rgba(15,23,42,0.05)]";

const labelCls =
  "text-[11px] font-semibold uppercase tracking-[0.05em] text-[#45464d] font-body";

// ── Widget card shell ────────────────────────────────────────────────────────

function WidgetCard({
  id,
  title,
  onRemove,
  children,
  headerExtra,
}: {
  id: string;
  title: string;
  onRemove: (id: string) => void;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
}) {
  return (
    <div className={`${cardCls} flex flex-col h-full overflow-hidden select-none`}>
      <div className="widget-drag-handle flex items-center justify-between px-4 py-2.5 border-b border-[#c6c6cd] cursor-grab active:cursor-grabbing shrink-0">
        <div className="flex items-center gap-2">
          <GripHorizontal size={13} className="text-[#c6c6cd]" />
          <span className="font-display text-[15px] font-semibold text-[#0b1c30]">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {headerExtra}
          <button
            className="w-5 h-5 rounded flex items-center justify-center text-[#c6c6cd] hover:text-[#ba1a1a] hover:bg-[#ba1a1a]/8 transition-colors"
            title="Remove widget"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onRemove(id)}
          >
            <X size={12} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}

// ── Widget contents ──────────────────────────────────────────────────────────

function ContactWidget({ customer }: { customer: Customer }) {
  const rows = [
    { label: "Switchboard",        value: null,          icon: Phone },
    { label: "Accounts Department",value: null,          icon: Phone },
    { label: "Procurement",        value: null,          icon: Phone },
    { label: "Cell Phone",         value: customer.phone, icon: Phone },
    { label: "Fax",                value: customer.fax,  icon: Phone },
  ].filter((r) => r.value !== undefined);

  return (
    <div className="px-4 py-1 h-full overflow-auto font-body">
      {rows.map(({ label, value, icon: Icon }) => (
        <div
          key={label}
          className="flex items-center justify-between py-2.5 border-b border-[#c6c6cd]/40 last:border-0"
        >
          <div>
            <p className={`${labelCls} mb-0.5`}>{label}</p>
            <p className="text-[14px] text-[#0b1c30]">{value || "—"}</p>
          </div>
          <button className="w-7 h-7 rounded border border-[#c6c6cd]/60 bg-white hover:border-[#5bb8fe] hover:text-[#006398] flex items-center justify-center text-[#76777d] transition-colors">
            <Icon size={12} />
          </button>
        </div>
      ))}
      {customer.eMail && (
        <div className="flex items-center justify-between py-2.5">
          <div>
            <p className={`${labelCls} mb-0.5`}>Email</p>
            <p className="text-[14px] text-[#0b1c30]">{customer.eMail.trim()}</p>
          </div>
          <button className="w-7 h-7 rounded border border-[#c6c6cd]/60 bg-white hover:border-[#5bb8fe] hover:text-[#006398] flex items-center justify-center text-[#76777d] transition-colors">
            <Mail size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

function MapWidget({ customer }: { customer: Customer }) {
  const city =
    [customer.address3, customer.address4].filter(Boolean).join(", ") ||
    "Location not set";

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 relative overflow-hidden bg-[#16202e]">
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 300 160"
          preserveAspectRatio="xMidYMid slice"
        >
          <line x1="0"   y1="55"  x2="300" y2="55"  stroke="#1e2d40" strokeWidth="9" />
          <line x1="0"   y1="110" x2="300" y2="110" stroke="#1e2d40" strokeWidth="5" />
          <line x1="70"  y1="0"   x2="70"  y2="160" stroke="#1e2d40" strokeWidth="11" />
          <line x1="170" y1="0"   x2="170" y2="160" stroke="#1e2d40" strokeWidth="7" />
          <line x1="240" y1="0"   x2="240" y2="160" stroke="#1e2d40" strokeWidth="4" />
          <line x1="0"   y1="30"  x2="300" y2="30"  stroke="#1b2738" strokeWidth="2" />
          <line x1="0"   y1="80"  x2="300" y2="80"  stroke="#1b2738" strokeWidth="2" />
          <line x1="0"   y1="135" x2="300" y2="135" stroke="#1b2738" strokeWidth="2" />
          <line x1="120" y1="0"   x2="120" y2="160" stroke="#1b2738" strokeWidth="2" />
          <line x1="200" y1="0"   x2="200" y2="160" stroke="#1b2738" strokeWidth="2" />
          <line x1="260" y1="0"   x2="260" y2="160" stroke="#1b2738" strokeWidth="2" />
          <rect x="75"  y="60"  width="90" height="45" fill="#1a2838" rx="1" />
          <rect x="175" y="60"  width="60" height="45" fill="#1a2838" rx="1" />
          <rect x="0"   y="60"  width="65" height="45" fill="#1a2838" rx="1" />
          <rect x="0"   y="115" width="65" height="40" fill="#1a2838" rx="1" />
          <rect x="75"  y="115" width="90" height="40" fill="#1a2838" rx="1" />
          <rect x="245" y="60"  width="55" height="45" fill="#1a2838" rx="1" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="w-3.5 h-3.5 rounded-full bg-[#5bb8fe] ring-[6px] ring-[#5bb8fe]/20 shadow-lg shadow-[#5bb8fe]/40" />
            <div className="w-0.5 h-3 bg-[#5bb8fe]/50 mt-0.5" />
          </div>
        </div>
      </div>
      <div className="px-4 py-2.5 flex items-center gap-2 border-t border-[#c6c6cd]">
        <MapPin size={12} className="text-[#76777d] shrink-0" />
        <p className="font-body text-[13px] text-[#45464d]">{city}</p>
      </div>
    </div>
  );
}

function FinancialAdminWidget({ customer }: { customer: Customer }) {
  return (
    <div className="px-4 py-3 h-full overflow-auto font-body">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-4">
        <div>
          <p className={`${labelCls} mb-1`}>VAT Number</p>
          <p className="text-[14px] text-[#0b1c30]">{customer.gstNumber || "—"}</p>
        </div>
        <div>
          <p className={`${labelCls} mb-1`}>Credit Limit</p>
          <p className="font-data text-[14px] text-[#0b1c30]">
            R {customer.creditLimit.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p className={`${labelCls} mb-1`}>Trade Discount</p>
          <p className="text-[14px] text-[#0b1c30]">—</p>
        </div>
        <div>
          <p className={`${labelCls} mb-1`}>Tax Status</p>
          <span className="inline-flex items-center text-[11px] font-semibold text-[#009668] bg-[#009668]/10 border border-[#009668]/20 px-2 py-0.5 rounded-xl">
            Compliant
          </span>
        </div>
      </div>

      <div className="border-t border-[#c6c6cd]/40 pt-3">
        <p className={`${labelCls} mb-3 text-[#76777d]`}>Classification</p>
        <div className="grid grid-cols-3 gap-x-4 gap-y-3">
          <div>
            <p className={`${labelCls} mb-1`}>Rep Code</p>
            <p className="text-[14px] text-[#0b1c30]">{customer.repCode || "—"}</p>
          </div>
          <div>
            <p className={`${labelCls} mb-1`}>Area Code</p>
            <p className="text-[14px] text-[#0b1c30]">{customer.category || "—"}</p>
          </div>
          <div>
            <p className={`${labelCls} mb-1`}>Terms</p>
            <p className="text-[14px] text-[#0b1c30]">30 Days</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotesWidget() {
  return (
    <div className="p-3 h-full flex flex-col font-body">
      <div className="flex items-center gap-0.5 pb-2 mb-2 border-b border-[#c6c6cd]/40 shrink-0">
        {[
          { Icon: Bold,          label: "Bold" },
          { Icon: Italic,        label: "Italic" },
          { Icon: Underline,     label: "Underline" },
          { Icon: Strikethrough, label: "Strikethrough" },
        ].map(({ Icon, label }) => (
          <button
            key={label}
            title={label}
            className="w-6 h-6 rounded flex items-center justify-center text-[#45464d] hover:bg-[#eff4ff] hover:text-[#006398] transition-colors"
          >
            <Icon size={12} />
          </button>
        ))}
        <div className="w-px h-4 bg-[#c6c6cd] mx-1" />
        {[
          { Icon: List,         label: "Bullet list" },
          { Icon: ListOrdered,  label: "Numbered list" },
        ].map(({ Icon, label }) => (
          <button
            key={label}
            title={label}
            className="w-6 h-6 rounded flex items-center justify-center text-[#45464d] hover:bg-[#eff4ff] hover:text-[#006398] transition-colors"
          >
            <Icon size={12} />
          </button>
        ))}
      </div>
      <textarea
        className="flex-1 resize-none text-[14px] text-[#0b1c30] placeholder:text-[#76777d] focus:outline-none leading-relaxed"
        placeholder="Add notes about this client…"
      />
    </div>
  );
}

function ActivityWidget() {
  const typeCls: Record<string, string> = {
    INVOICE: "bg-[#eff4ff] text-[#006398] border border-[#c6c6cd]/60",
    PAYMENT: "bg-[#009668]/10 text-[#009668] border border-[#009668]/20",
    CREDIT:  "bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20",
  };

  return (
    <div className="px-4 py-3 h-full flex flex-col font-body">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <p className={labelCls}>Latest transactions</p>
        <button className="text-[12px] font-medium text-[#006398] hover:underline underline-offset-2">
          View All →
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#c6c6cd]/40">
              <th className={`${labelCls} text-left pb-2 font-semibold`}>Date</th>
              <th className={`${labelCls} text-left pb-2 font-semibold`}>Type</th>
              <th className={`${labelCls} text-right pb-2 font-semibold`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ACTIVITY.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-[#c6c6cd]/30 last:border-0 ${i % 2 === 1 ? "bg-[#f8f9ff]" : "bg-white"}`}
              >
                <td className="py-2.5 text-[13px] text-[#45464d]">{row.date}</td>
                <td className="py-2.5">
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-xl ${typeCls[row.type]}`}>
                    {row.type}
                  </span>
                </td>
                <td className={`py-2.5 text-right font-data text-[13px] ${row.amount < 0 ? "text-[#009668]" : "text-[#0b1c30]"}`}>
                  {row.amount < 0 ? "− " : ""}R{" "}
                  {Math.abs(row.amount).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const accNo = params.accNo as string;

  const [activeNavItem, setActiveNavItem] = useState("Clients");
  const [isExpanded, setIsExpanded] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { width, containerRef, mounted } = useContainerWidth();
  const [showCustomize, setShowCustomize] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState<Set<string>>(
    () => new Set(["contact", "map", "finAdmin", "notes", "activity"]),
  );
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(DEFAULT_LAYOUTS);

  useEffect(() => {
    if (!accNo) return;
    try {
      const savedLayout = localStorage.getItem(`layout:${accNo}`);
      if (savedLayout) setLayouts(JSON.parse(savedLayout));
      const savedWidgets = localStorage.getItem(`widgets:${accNo}`);
      if (savedWidgets) setVisibleWidgets(new Set(JSON.parse(savedWidgets)));
    } catch {}
  }, [accNo]);

  useEffect(() => {
    const stored = localStorage.getItem("selectedCompany");
    if (!stored) return;
    let company: { companyNr: string };
    try {
      company = JSON.parse(stored);
    } catch {
      setError("Could not read company data.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `/api/customers/customer?companyNr=${company.companyNr}&accNo=${accNo}`,
        );
        const result = await res.json();
        const data = result?.data?.data?.customer;
        if (result.success && data) {
          setCustomer(data);
        } else {
          setError("Customer not found.");
        }
      } catch {
        setError("Failed to load customer.");
      } finally {
        setLoading(false);
      }
    })();
  }, [accNo]);

  const handleLayoutChange = useCallback(
    (_: unknown, allLayouts: ResponsiveLayouts) => {
      setLayouts(allLayouts);
      try { localStorage.setItem(`layout:${accNo}`, JSON.stringify(allLayouts)); } catch {}
    },
    [accNo],
  );

  const removeWidget = useCallback(
    (id: string) => {
      setVisibleWidgets((prev) => {
        const next = new Set(prev);
        next.delete(id);
        try { localStorage.setItem(`widgets:${accNo}`, JSON.stringify([...next])); } catch {}
        return next;
      });
    },
    [accNo],
  );

  const toggleWidget = useCallback(
    (id: string) => {
      setVisibleWidgets((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        try { localStorage.setItem(`widgets:${accNo}`, JSON.stringify([...next])); } catch {}
        return next;
      });
    },
    [accNo],
  );

  const resetLayout = useCallback(() => {
    setLayouts(DEFAULT_LAYOUTS);
    setVisibleWidgets(new Set(["contact", "map", "finAdmin", "notes", "activity"]));
    try {
      localStorage.removeItem(`layout:${accNo}`);
      localStorage.removeItem(`widgets:${accNo}`);
    } catch {}
  }, [accNo]);

  const initials = customer?.name
    .split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() ?? "?";

  const totalOutstanding = customer?.balance ?? 0;
  const creditAvailable = Math.max(0, (customer?.creditLimit ?? 0) - (customer?.balance ?? 0));

  const filteredLayout = {
    lg: (layouts.lg ?? DEFAULT_LAYOUTS.lg!).filter((l) => visibleWidgets.has(l.i)),
  };

  return (
    <div className="flex flex-col h-screen bg-[#f8f9ff] font-body">
      <div className="flex flex-1 overflow-hidden">
        <FinanceSidebar
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
          activeItem={activeNavItem}
          setActiveItem={setActiveNavItem}
        />

        <div className="flex flex-col flex-1 overflow-hidden">

          {/* ── App header ── */}
          <header className="h-12 bg-white border-b border-[#c6c6cd] flex items-center justify-between px-4 shrink-0 shadow-[0px_1px_2px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-[#0b1c30] flex items-center justify-center shrink-0">
                <span className="text-white text-[9px] font-semibold tracking-widest font-body">
                  GEN
                </span>
              </div>
              <p className="font-body text-sm text-[#45464d]">
                Revelation Suite —{" "}
                <span className="font-semibold text-[#0b1c30] tracking-wide">FINANCE</span>
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button className="w-8 h-8 rounded flex items-center justify-center text-[#76777d] hover:text-[#0b1c30] hover:bg-[#eff4ff] transition-colors">
                <User size={16} />
              </button>
              <button className="w-8 h-8 rounded flex items-center justify-center text-[#76777d] hover:text-[#0b1c30] hover:bg-[#eff4ff] transition-colors">
                <MessageCircle size={16} />
              </button>
            </div>
          </header>

          {/* ── Scrollable body ── */}
          <main className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center h-full">
                <p className="font-body text-sm text-[#76777d]">Loading client…</p>
              </div>
            )}
            {error && (
              <div className="flex items-center justify-center h-full">
                <p className="font-body text-sm text-[#ba1a1a]">{error}</p>
              </div>
            )}

            {customer && (
              <div className="p-5 space-y-4">

                {/* ── Client header card ── */}
                <div className={`${cardCls} px-5 py-4 flex items-center justify-between`}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#131b2e] flex items-center justify-center shrink-0">
                      <span className="font-display text-white text-sm font-semibold">{initials}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="font-display text-[20px] font-semibold leading-7 text-[#0b1c30]">
                          {customer.name}
                        </h1>
                        {customer.category && (
                          <span className="font-body text-[14px] text-[#45464d]">
                            ({customer.category})
                          </span>
                        )}
                        <span
                          className={`font-body text-[11px] font-semibold px-2.5 py-0.5 rounded-xl border ${
                            customer.activeYN
                              ? "bg-[#009668]/10 text-[#009668] border-[#009668]/25"
                              : "bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/25"
                          }`}
                        >
                          {customer.activeYN ? "Active" : "Inactive"}
                        </span>
                      </div>
                      {customer.eMail?.trim() && (
                        <p className="font-body text-[13px] text-[#45464d] mt-0.5">
                          {customer.eMail.trim()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button className={btnSecondaryCls}>
                      <Download size={13} /> Export
                    </button>
                    <button className={btnSecondaryCls}>
                      <Edit3 size={13} /> Edit Client
                    </button>
                    <button className={btnPrimaryCls}>
                      <Plus size={13} /> New Entry
                    </button>
                  </div>
                </div>

                {/* ── KPI banner ── */}
                <div className={`${cardCls} px-5 py-4 grid grid-cols-3 divide-x divide-[#c6c6cd]`}>
                  <div className="pr-8">
                    <p className={`${labelCls} mb-1.5`}>Total Outstanding</p>
                    <p className="font-data text-[20px] font-bold text-[#0b1c30]">
                      R {totalOutstanding.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="px-8">
                    <p className={`${labelCls} mb-1.5`}>Overdue</p>
                    <p className="font-data text-[20px] font-bold text-[#ba1a1a]">R 0.00</p>
                  </div>
                  <div className="pl-8">
                    <p className={`${labelCls} mb-1.5`}>Credit Available</p>
                    <p className="font-data text-[20px] font-bold text-[#009668]">
                      R {creditAvailable.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* ── Widget toolbar ── */}
                <div className="flex items-center justify-between">
                  <p className="font-body text-[13px] text-[#76777d]">
                    Drag widgets to rearrange · Resize from the corner
                  </p>
                  <div className="flex items-center gap-2 relative">
                    <button
                      onClick={resetLayout}
                      className={`${btnSecondaryCls} h-7 px-3 text-[12px]`}
                      title="Reset layout"
                    >
                      <RotateCcw size={12} /> Reset
                    </button>
                    <button
                      onClick={() => setShowCustomize((v) => !v)}
                      className={`h-7 px-3 rounded border text-[12px] font-medium font-body flex items-center gap-1.5 transition-colors shadow-[0px_1px_2px_rgba(15,23,42,0.05)] ${
                        showCustomize
                          ? "bg-[#0b1c30] text-white border-[#0b1c30]"
                          : "bg-white border-[#c6c6cd] text-[#0b1c30] hover:bg-[#f8f9ff] hover:border-[#5bb8fe]"
                      }`}
                    >
                      <LayoutDashboard size={12} /> Customise
                    </button>

                    {/* Customise dropdown */}
                    {showCustomize && (
                      <div className="absolute right-0 top-9 z-50 w-56 bg-white rounded-lg border border-[#c6c6cd] shadow-[0px_4px_12px_rgba(15,23,42,0.08)] p-2">
                        <p className={`${labelCls} px-2 py-1.5`}>Toggle Widgets</p>
                        {Object.entries(WIDGET_META).map(([id, meta]) => (
                          <button
                            key={id}
                            onClick={() => toggleWidget(id)}
                            className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-[#eff4ff] transition-colors text-left"
                          >
                            <span className="font-body text-[13px] text-[#0b1c30]">
                              {meta.title}
                            </span>
                            <div
                              className={`w-8 h-[18px] rounded-full transition-colors relative flex-shrink-0 ${
                                visibleWidgets.has(id) ? "bg-[#006398]" : "bg-[#c6c6cd]"
                              }`}
                            >
                              <div
                                className={`absolute top-[3px] w-3 h-3 rounded-full bg-white shadow-sm transition-all ${
                                  visibleWidgets.has(id) ? "left-[17px]" : "left-[3px]"
                                }`}
                              />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Widget grid ── */}
                <div
                  ref={containerRef}
                  onClick={() => showCustomize && setShowCustomize(false)}
                >
                  {mounted && (
                    <ResponsiveGridLayout
                      className="layout"
                      width={width}
                      layouts={filteredLayout}
                      breakpoints={{ lg: 1200, md: 768 }}
                      cols={{ lg: 12, md: 10 }}
                      rowHeight={50}
                      margin={[12, 12]}
                      containerPadding={[0, 0]}
                      dragConfig={{ handle: ".widget-drag-handle" }}
                      onLayoutChange={handleLayoutChange}
                      resizeConfig={{ handles: ["se"] }}
                    >
                      {visibleWidgets.has("contact") && (
                        <div key="contact">
                          <WidgetCard id="contact" title="Contact Information" onRemove={removeWidget}>
                            <ContactWidget customer={customer} />
                          </WidgetCard>
                        </div>
                      )}
                      {visibleWidgets.has("map") && (
                        <div key="map">
                          <WidgetCard id="map" title="Map Location" onRemove={removeWidget}>
                            <MapWidget customer={customer} />
                          </WidgetCard>
                        </div>
                      )}
                      {visibleWidgets.has("finAdmin") && (
                        <div key="finAdmin">
                          <WidgetCard id="finAdmin" title="Financial & Admin" onRemove={removeWidget}>
                            <FinancialAdminWidget customer={customer} />
                          </WidgetCard>
                        </div>
                      )}
                      {visibleWidgets.has("notes") && (
                        <div key="notes">
                          <WidgetCard id="notes" title="Internal Notes" onRemove={removeWidget}>
                            <NotesWidget />
                          </WidgetCard>
                        </div>
                      )}
                      {visibleWidgets.has("activity") && (
                        <div key="activity">
                          <WidgetCard id="activity" title="Recent Activity" onRemove={removeWidget}>
                            <ActivityWidget />
                          </WidgetCard>
                        </div>
                      )}
                    </ResponsiveGridLayout>
                  )}
                </div>

                {/* ── Footer ── */}
                <div className="flex items-center justify-end pb-5">
                  <button
                    onClick={() => router.push("/Finance?view=Clients")}
                    className={btnPrimaryCls}
                  >
                    ← Back to Clients
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
