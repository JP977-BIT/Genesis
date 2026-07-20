"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  FileText,
  Loader2,
  Mail,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Truck,
  User,
} from "lucide-react";
import FinanceSidebar from "@/app/Finance/components/financeSidebar";
import ConfirmCancelModal from "@/app/Finance/components/ConfirmCancelModal";

// ── Design tokens (shared with the client detail page) ───────────────────────
const labelCls =
  "block text-[11px] font-semibold uppercase tracking-[0.05em] text-[#45464d] mb-1";
const inputCls =
  "w-full h-11 px-3.5 text-[15px] border border-[#c6c6cd] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d9488]/20 focus:border-[#0d9488] transition font-body bg-white text-[#0b1c30] disabled:bg-[#f0f2f8] disabled:text-[#76777d]";

const VAT_RATE = 0.15;

// Revelation's deliveryMethod / status are numeric codes; labels are ours.
const DELIVERY_METHODS = [
  { value: 0, label: "We deliver" },
  { value: 1, label: "Client collects" },
  { value: 2, label: "Courier" },
];
const STATUSES = [
  { value: 0, label: "Draft" },
  { value: 1, label: "Sent to client" },
  { value: 2, label: "Accepted" },
  { value: 3, label: "Declined" },
  { value: 4, label: "Expired" },
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface Customer {
  accNo: string;
  name: string;
  address1: string;
  address2: string;
  address3: string;
  address4: string;
  gstNumber: string;
  terms: string;
  repCode: string;
}

interface StockOption {
  code: string;
  description: string;
  exclPrice: number;
  onHand: number;
}

interface QuoteLine {
  code: string;
  description: string;
  price: number; // VAT-exclusive unit price
  qty: number;
  disc: number; // line discount %
}

// Shape of a quote as returned by /api/quotes/quote — only the fields the
// editor prefills from. Strings may be null or space-padded on quotes created
// by Revelation itself.
export interface RevelationQuoteLine {
  lineNo: number;
  stockcode: string;
  description: string;
  price: number;
  quantity: number;
  discPercent: number;
}

export interface RevelationQuote {
  quoteNo: string;
  accNo: string;
  notes: string | null;
  orderType: string | null;
  repCode: string | null;
  deliveryAddress1: string | null;
  deliveryAddress2: string | null;
  deliveryAddress3: string | null;
  deliveryAddress4: string | null;
  deliveryAddress5: string | null;
  date: string;
  expiryDate: string | null;
  expectedDate: string | null;
  freight: number;
  discPercent: number;
  warehouseNr: number;
  deliveryMethod: number;
  status: number;
  body: RevelationQuoteLine[];
}

function fmtRand(n: number): string {
  return (
    "R " +
    n.toLocaleString("en-ZA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function lineExclTotal(l: QuoteLine): number {
  return l.qty * l.price * (1 - l.disc / 100);
}

function isoDatePlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Editor ────────────────────────────────────────────────────────────────────
// Shared by the "new quote" page (no initialQuote) and the amend page
// (initialQuote = a fetched quote to prefill from).
//
// Amend semantics — proven live 2026-07-20 on the test server: Revelation has
// NO update endpoint for sales quotes, and /api/quotes/createquote always
// assigns a fresh quote number no matter what state/quoteNo/keys are resent.
// "Amending" therefore always saves a REVISION under a new number; the
// original quote is never modified.
interface QuoteEditorProps {
  accNo: string;
  initialQuote?: RevelationQuote | null;
}

export default function QuoteEditor({ accNo, initialQuote }: QuoteEditorProps) {
  const router = useRouter();
  const isEdit = Boolean(initialQuote);

  const [isExpanded, setIsExpanded] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("sidebar-pinned") === "true",
  );
  const [activeNavItem, setActiveNavItem] = useState("Clients");

  const [companyNr] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem("selectedCompany");
      if (stored)
        return (JSON.parse(stored) as { companyNr: string }).companyNr;
    } catch {}
    return null;
  });

  // ── Customer ──
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        } else {
          setLoadError("Customer not found.");
        }
      } catch {
        if (active) setLoadError("Failed to load customer.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [accNo, companyNr]);

  // ── Stock catalogue for the item search ──
  const [stock, setStock] = useState<StockOption[]>([]);
  useEffect(() => {
    if (!companyNr) return;
    let active = true;
    (async () => {
      try {
        const result = await fetch(
          `/api/stock?companyNr=${companyNr}&numberOfRecords=5000`,
        ).then((r) => r.json());
        if (!active || !result.success) return;
        const headers = (result.data.stockHeaders ?? []) as Array<{
          code?: string;
          description?: string;
          exclPrice?: number;
          onHand?: number;
        }>;
        const seen = new Set<string>();
        const options: StockOption[] = [];
        for (const h of headers) {
          const code = h.code ?? "";
          if (!code || seen.has(code)) continue;
          seen.add(code);
          options.push({
            code,
            description: h.description ?? "",
            exclPrice: h.exclPrice ?? 0,
            onHand: h.onHand ?? 0,
          });
        }
        setStock(options);
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, [companyNr]);

  // ── Quote header fields ──
  // Initial values come from initialQuote in edit mode, defaults otherwise.
  // Lazy initializers are safe: the amend page mounts this component only
  // after the quote has loaded, keyed by quoteNo.
  const [initialExpectedDate] = useState(
    () => initialQuote?.expectedDate?.slice(0, 10) ?? isoDatePlusDays(7),
  );
  const [initialExpiryDate] = useState(
    () => initialQuote?.expiryDate?.slice(0, 10) ?? isoDatePlusDays(30),
  );

  // A quote's own delivery address wins over the client-file address when any
  // of its lines are filled in.
  const quoteAddress = initialQuote
    ? [
        initialQuote.deliveryAddress1 ?? "",
        initialQuote.deliveryAddress2 ?? "",
        initialQuote.deliveryAddress3 ?? "",
        initialQuote.deliveryAddress4 ?? "",
        initialQuote.deliveryAddress5 ?? "",
      ]
    : null;
  const quoteHasAddress = quoteAddress?.some((a) => a.trim() !== "") ?? false;

  const [useClientAddress, setUseClientAddress] = useState(!quoteHasAddress);
  const [deliveryMethod, setDeliveryMethod] = useState(
    initialQuote?.deliveryMethod ?? 0,
  );
  const [expectedDate, setExpectedDate] = useState(initialExpectedDate);
  const [expiryDate, setExpiryDate] = useState(initialExpiryDate);
  const [warehouseNr, setWarehouseNr] = useState(initialQuote?.warehouseNr ?? 0);
  const [status, setStatus] = useState(initialQuote?.status ?? 0);
  const [orderType, setOrderType] = useState(
    () => initialQuote?.orderType?.trim() || "Quote",
  );
  const [notes, setNotes] = useState(() => initialQuote?.notes?.trim() ?? "");

  // Address and rep are derived from the client's file until the user edits
  // them — no effect-based syncing needed.
  const clientAddress = useMemo(
    () => [
      customer?.address1 ?? "",
      customer?.address2 ?? "",
      customer?.address3 ?? "",
      customer?.address4 ?? "",
      "",
    ],
    [customer],
  );
  const [customAddress, setCustomAddress] = useState<string[] | null>(
    quoteHasAddress ? quoteAddress : null,
  );
  const address = useClientAddress
    ? clientAddress
    : (customAddress ?? clientAddress);

  const [repCodeOverride, setRepCodeOverride] = useState<string | null>(
    () => initialQuote?.repCode?.trim() || null,
  );
  const repCode = repCodeOverride ?? customer?.repCode ?? "";

  // ── Line items ──
  const [lines, setLines] = useState<QuoteLine[]>(
    () =>
      initialQuote?.body.map((b) => ({
        code: b.stockcode,
        description: b.description,
        price: b.price,
        qty: b.quantity,
        disc: b.discPercent,
      })) ?? [],
  );
  const [discPercent, setDiscPercent] = useState(initialQuote?.discPercent ?? 0);
  const [freight, setFreight] = useState(initialQuote?.freight ?? 0);

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + lineExclTotal(l), 0),
    [lines],
  );
  const discountAmount = subtotal * (discPercent / 100);
  const exclBase = subtotal - discountAmount + freight;
  const vatAmount = exclBase * VAT_RATE;
  const grandTotal = exclBase + vatAmount;

  const updateLine = (i: number, patch: Partial<QuoteLine>) =>
    setLines((prev) =>
      prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    );
  const removeLine = (i: number) =>
    setLines((prev) => prev.filter((_, idx) => idx !== i));

  // ── Item search ──
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // With no query the whole catalogue is browsable; typing narrows it. The
  // DOM list is capped — the footer tells the user how to see the rest.
  const MAX_VISIBLE_ITEMS = 100;
  const { suggestions, matchCount } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? stock.filter(
          (s) =>
            s.code.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q),
        )
      : stock;
    return {
      suggestions: matches.slice(0, MAX_VISIBLE_ITEMS),
      matchCount: matches.length,
    };
  }, [query, stock]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const addItem = (s: StockOption) => {
    setLines((prev) => {
      const existing = prev.findIndex((l) => l.code === s.code);
      if (existing >= 0) {
        return prev.map((l, i) =>
          i === existing ? { ...l, qty: l.qty + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          code: s.code,
          description: s.description,
          price: s.exclPrice,
          qty: 1,
          disc: 0,
        },
      ];
    });
    setQuery("");
    setSearchOpen(false);
  };

  // ── Save ──
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Cancel guard ──
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  // "Dirty" means the user changed ANY editable field from its initial value —
  // the defaults in new mode, the loaded quote's values in edit mode. One
  // snapshot of the initial state is captured on first render and compared
  // against the same fields on every render.
  const editableSnapshot = JSON.stringify({
    lines,
    notes,
    customAddress,
    useClientAddress,
    deliveryMethod,
    warehouseNr,
    status,
    orderType,
    repCodeOverride,
    discPercent,
    freight,
    expectedDate,
    expiryDate,
  });
  const [initialSnapshot] = useState(editableSnapshot);
  const isDirty = editableSnapshot !== initialSnapshot;

  const isDirtyRef = useRef(false);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // Browser back button: once the form has content, plant a duplicate history
  // entry so pressing back lands here again and we can ask via the modal
  // instead of silently losing the quote.
  const backGuardArmed = useRef(false);
  const leavingRef = useRef(false);

  useEffect(() => {
    if (isDirty && !backGuardArmed.current) {
      backGuardArmed.current = true;
      window.history.pushState(null, "", window.location.href);
    }
  }, [isDirty]);

  useEffect(() => {
    const onPopState = () => {
      if (!backGuardArmed.current || leavingRef.current) return;
      if (isDirtyRef.current) {
        window.history.pushState(null, "", window.location.href);
        setShowCancelConfirm(true);
      } else {
        backGuardArmed.current = false;
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Refresh / tab close can't show our modal — ask the browser to show its
  // native "unsaved changes" warning instead.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const discardAndLeave = () => {
    leavingRef.current = true;
    router.push(`/Finance/clients/${accNo}`);
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowCancelConfirm(true);
    } else {
      router.push(`/Finance/clients/${accNo}`);
    }
  };

  const handleSave = async () => {
    if (!customer || !companyNr) return;
    if (lines.length === 0) {
      setSaveError("Add at least one item before saving the quote.");
      return;
    }
    setSaving(true);
    setSaveError(null);

    const now = new Date().toISOString();
    const daysValid = Math.max(
      0,
      Math.round(
        (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
    );
    // Revelation write endpoints reject null nested values — every field is
    // sent as a ""/0/false shell (same lesson as CreateStockModal).
    // Whether new or amend, this is always a CREATE: createquote assigns the
    // next quote number itself (blank quoteNo/keys), so an amend saves a
    // revision and never touches the original.
    const salesQuote = {
      state: 0,
      headerKey: "",
      trankey: "",
      accNo: customer.accNo,
      accName: customer.name,
      quoteNo: "",
      // Proven by live bisect: with any other ledger value the upstream
      // reports success but silently persists nothing. "Q" = sales quote.
      ledger: "Q",
      exclIncl: "",
      gstNo: customer.gstNumber ?? "",
      notes,
      orderType,
      repCode,
      deliveryAddress1: address[0],
      deliveryAddress2: address[1],
      deliveryAddress3: address[2],
      deliveryAddress4: address[3],
      deliveryAddress5: address[4],
      date: now,
      expiryDate: new Date(expiryDate).toISOString(),
      expectedDate: new Date(expectedDate).toISOString(),
      salesBy: now,
      discount: discountAmount,
      goodsValue: subtotal,
      freight,
      tax: vatAmount,
      total: grandTotal,
      totalCost: 0,
      totalQtyOwing: 0,
      discPercent,
      realizationPercent: 0,
      realizationAmount: 0,
      numberOfLines: lines.length,
      currencyCode: 0,
      daysValid,
      internalOrderNr: 0,
      contactNo: 0,
      warehouseNr,
      deliveryMethod,
      status,
      body: lines.map((l, i) => ({
        trankey: "",
        lineNo: i + 1,
        ledger: "",
        accNo: customer.accNo,
        orderType,
        stockcode: l.code,
        description: l.description,
        taxCode: "",
        orderNo: "",
        qtyDecimal: "",
        prcDecimal: "",
        repCode,
        contra: "",
        programVersion: "",
        price: l.price,
        quantity: l.qty,
        discPercent: l.disc,
        total: lineExclTotal(l) * (1 + VAT_RATE),
        stillOwing: 0,
        exclTotal: lineExclTotal(l),
        exclPriceAfterDisc: l.price * (1 - l.disc / 100),
        costPrice: 0,
        date: now,
        userNo: 0,
        currencyCode: 0,
        warehouse: warehouseNr,
        dbId: 0,
        promoYN: false,
      })),
    };

    try {
      const res = await fetch("/api/quotes/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyNr, salesQuote }),
      });
      const result = await res.json();
      if (result.success) {
        leavingRef.current = true;
        router.push(`/Finance/clients/${accNo}`);
      } else {
        setSaveError(result.message || "Failed to save the quote.");
      }
    } catch {
      setSaveError("Failed to save the quote. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──
  return (
    <div className="flex h-screen bg-[#f8f9ff] font-body">
      <FinanceSidebar
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
        activeItem={activeNavItem}
        setActiveItem={setActiveNavItem}
        navigateOnSelect
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-[#76777d]">Loading client…</p>
          </div>
        )}

        {loadError && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <p className="text-sm text-[#ba1a1a]">{loadError}</p>
            <button
              onClick={() => router.push(`/Finance/clients/${accNo}`)}
              className="h-8 px-4 rounded border border-[#c6c6cd] bg-white text-[#0b1c30] text-sm font-medium flex items-center gap-1.5 hover:bg-[#f8f9ff] transition-colors"
            >
              <ArrowLeft size={14} /> Back to Client
            </button>
          </div>
        )}

        {customer && !loading && !loadError && (
          <>
            {/* ── Header ── */}
            <header className="bg-white border-b border-[#c6c6cd] px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3.5">
                <button
                  onClick={handleCancel}
                  className="w-10 h-10 rounded-lg border border-[#c6c6cd] bg-white flex items-center justify-center text-[#45464d] hover:bg-[#f8f9ff] hover:text-[#0b1c30] transition-colors shrink-0"
                  title="Back to client"
                >
                  <ArrowLeft size={17} />
                </button>
                <div className="w-11 h-11 rounded-lg bg-[#0d9488]/10 border border-[#0d9488]/20 flex items-center justify-center text-[#0d9488] shrink-0">
                  <FileText size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="font-semibold text-[19px] text-[#0b1c30]">
                      {isEdit
                        ? `Revise Quote ${initialQuote?.quoteNo.trim()}`
                        : "New Quote"}
                    </h1>
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                        status === 2
                          ? "bg-[#009668]/10 text-[#009668] border-[#009668]/25"
                          : status === 3
                            ? "bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/25"
                            : status === 1
                              ? "bg-[#F59E0B]/10 text-[#b45309] border-[#F59E0B]/30"
                              : status === 4
                                ? "bg-[#e8eaf0] text-[#45464d] border-[#c6c6cd]"
                                : "bg-[#eff4ff] text-[#006398] border-[#006398]/20"
                      }`}
                    >
                      {STATUSES.find((s) => s.value === status)?.label}
                    </span>
                  </div>
                  <p className="text-[13.5px] text-[#45464d] mt-0.5">
                    for <strong>{customer.name}</strong> ·{" "}
                    {new Date().toLocaleDateString("en-ZA", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                    {isEdit &&
                      " — saving creates a new quote number; the original stays unchanged"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCancel}
                className="h-11 px-5 rounded-lg border border-[#c6c6cd] bg-white text-[#0b1c30] text-[15px] font-medium flex items-center gap-1.5 hover:bg-[#f8f9ff] transition-colors"
              >
                Cancel
              </button>
            </header>

            {/* ── Scrollable body ── */}
            <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-[18px]">
              {/* Client strip */}
              <section className="bg-white rounded-lg border border-[#c6c6cd] shadow-[0px_1px_2px_rgba(15,23,42,0.05)] flex items-center gap-4 px-5 py-4">
                <div className="w-11 h-11 rounded-lg bg-[#e8eaf0] flex items-center justify-center text-[#45464d] shrink-0">
                  <User size={20} />
                </div>
                <div>
                  <p className="text-[16px] font-semibold text-[#0b1c30]">
                    {customer.name}
                  </p>
                  <p className="text-[13px] text-[#76777d]">
                    This quote is for the client above — nothing to fill in
                    here.
                  </p>
                </div>
                <div className="ml-auto flex gap-10">
                  <div>
                    <p className={labelCls}>Account</p>
                    <p className="text-[15px] font-semibold text-[#0b1c30]">
                      {customer.accNo}
                    </p>
                  </div>
                  <div>
                    <p className={labelCls}>Terms</p>
                    <p className="text-[15px] font-semibold text-[#0b1c30]">
                      {customer.terms?.trim() || "—"}
                    </p>
                  </div>
                  <div>
                    <p className={labelCls}>VAT number</p>
                    <p className="text-[15px] font-semibold text-[#0b1c30]">
                      {customer.gstNumber?.trim() || "—"}
                    </p>
                  </div>
                </div>
              </section>

              {/* Delivery & quote details */}
              <section className="bg-white rounded-lg border border-[#c6c6cd] shadow-[0px_1px_2px_rgba(15,23,42,0.05)]">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-[#c6c6cd]/40">
                  <div className="w-9 h-9 rounded-lg bg-[#0d9488]/10 border border-[#0d9488]/20 flex items-center justify-center text-[#0d9488] shrink-0">
                    <Truck size={16} />
                  </div>
                  <div>
                    <h2 className="text-[16px] font-semibold text-[#0b1c30]">
                      Delivery &amp; quote details
                    </h2>
                    <p className="text-[13px] text-[#76777d]">
                      Already filled in from the client&apos;s file — only
                      change what&apos;s different for this quote.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-x-[18px] gap-y-4 px-5 py-[18px] items-start">
                  <label className="col-span-4 flex items-center gap-2.5 text-[15px] font-medium text-[#0b1c30] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useClientAddress}
                      onChange={(e) => setUseClientAddress(e.target.checked)}
                      className="w-5 h-5 rounded border-[#c6c6cd] accent-[#0d9488] cursor-pointer"
                    />
                    Deliver to the client&apos;s usual address
                  </label>

                  {(
                    [
                      ["Street address", "col-span-2"],
                      ["Suburb", ""],
                      ["City", ""],
                      ["Province", ""],
                      ["Postal code", ""],
                    ] as const
                  ).map(([label, span], i) => (
                    <div key={label} className={span}>
                      <label className={labelCls}>{label}</label>
                      <input
                        type="text"
                        value={address[i]}
                        disabled={useClientAddress}
                        onChange={(e) =>
                          setCustomAddress(
                            address.map((a, idx) =>
                              idx === i ? e.target.value : a,
                            ),
                          )
                        }
                        className={inputCls}
                      />
                    </div>
                  ))}

                  <div>
                    <label className={labelCls} htmlFor="delMethod">
                      How will it get there?
                    </label>
                    <select
                      id="delMethod"
                      value={deliveryMethod}
                      onChange={(e) =>
                        setDeliveryMethod(Number(e.target.value))
                      }
                      className={`${inputCls} cursor-pointer`}
                    >
                      {DELIVERY_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="expDate">
                      Expected delivery date
                    </label>
                    <input
                      id="expDate"
                      type="date"
                      value={expectedDate}
                      onChange={(e) => setExpectedDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="repCode">
                      Sales rep code
                    </label>
                    <input
                      id="repCode"
                      type="text"
                      value={repCode}
                      onChange={(e) => setRepCodeOverride(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="warehouseNr">
                      Warehouse number
                    </label>
                    <input
                      id="warehouseNr"
                      type="number"
                      min={0}
                      value={warehouseNr}
                      onChange={(e) =>
                        setWarehouseNr(Math.max(0, Number(e.target.value) || 0))
                      }
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className={labelCls} htmlFor="statusSel">
                      Quote status
                    </label>
                    <select
                      id="statusSel"
                      value={status}
                      onChange={(e) => setStatus(Number(e.target.value))}
                      className={`${inputCls} cursor-pointer`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="orderType">
                      Order type
                    </label>
                    <input
                      id="orderType"
                      type="text"
                      value={orderType}
                      onChange={(e) => setOrderType(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="validUntil">
                      Valid until
                    </label>
                    <input
                      id="validUntil"
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className={inputCls}
                    />
                    <p className="text-[12.5px] text-[#76777d] mt-1.5">
                      The client has until this date to accept.
                    </p>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="quoteNote">
                      Message to client{" "}
                      <span className="normal-case tracking-normal font-medium text-[#76777d]">
                        (optional)
                      </span>
                    </label>
                    <textarea
                      id="quoteNote"
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Delivery included within 20 km."
                      className={`${inputCls} h-auto min-h-11 py-2.5 resize-y`}
                    />
                  </div>
                </div>
              </section>

              {/* Items */}
              <section className="bg-white rounded-lg border border-[#c6c6cd] shadow-[0px_1px_2px_rgba(15,23,42,0.05)]">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-[#c6c6cd]/40">
                  <div className="w-9 h-9 rounded-lg bg-[#0d9488]/10 border border-[#0d9488]/20 flex items-center justify-center text-[#0d9488] shrink-0">
                    <ShoppingCart size={16} />
                  </div>
                  <div>
                    <h2 className="text-[16px] font-semibold text-[#0b1c30]">
                      Items on this quote
                    </h2>
                    <p className="text-[13px] text-[#76777d]">
                      Search for an item below and it will be added to the list.
                    </p>
                  </div>
                </div>

                {/* Search */}
                <div className="px-5 pt-4 pb-1 relative" ref={searchRef}>
                  <Search
                    size={20}
                    className="absolute left-9 top-1/2 -translate-y-[38%] text-[#76777d] pointer-events-none"
                  />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSearchOpen(true);
                    }}
                    onFocus={() => setSearchOpen(true)}
                    onClick={() => setSearchOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setSearchOpen(false);
                    }}
                    placeholder="Click to see the list, or type an item name or code…"
                    aria-label="Search or browse for an item to add"
                    className="w-full h-[52px] pl-[46px] pr-4 text-[16px] border-2 border-[#c6c6cd] rounded-[10px] focus:outline-none focus:border-[#0d9488] focus:ring-[3px] focus:ring-[#0d9488]/15 transition font-body bg-white text-[#0b1c30] placeholder:text-[#b0b1b8]"
                  />
                  {searchOpen && stock.length > 0 && (
                    <div className="absolute left-5 right-5 top-full -mt-0.5 z-30 bg-white border border-[#c6c6cd] rounded-[10px] shadow-[0_12px_32px_-8px_rgba(11,28,48,0.25)] overflow-hidden">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#76777d] px-4 py-2.5 border-b border-[#c6c6cd]/40 bg-[#f8f9ff]">
                        {query.trim()
                          ? `${matchCount.toLocaleString("en-ZA")} item${matchCount === 1 ? "" : "s"} found — click one to add it`
                          : "Scroll the list and click an item to add it, or type to narrow it down"}
                      </p>
                      <div className="max-h-[320px] overflow-y-auto">
                        {suggestions.length === 0 && (
                          <p className="px-4 py-3.5 text-[14px] text-[#76777d]">
                            No items match &ldquo;{query.trim()}&rdquo;. Check
                            the spelling or try fewer letters.
                          </p>
                        )}
                        {suggestions.map((s) => (
                          <button
                            key={s.code}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => addItem(s)}
                            className="w-full flex items-center gap-3.5 px-4 py-3 text-left border-t border-[#c6c6cd]/35 first:border-t-0 hover:bg-[#f8f9ff] transition-colors"
                          >
                            <span className="font-mono text-[12.5px] text-[#006398] bg-[#eff4ff] border border-[#006398]/20 px-2 py-0.5 rounded-md shrink-0">
                              {s.code}
                            </span>
                            <span className="text-[15px] text-[#0b1c30] flex-1 truncate">
                              {s.description}
                            </span>
                            <span className="text-[12.5px] text-[#009668] shrink-0">
                              {s.onHand} in stock
                            </span>
                            <span className="text-[15px] font-semibold text-[#0b1c30] tabular-nums shrink-0">
                              {fmtRand(s.exclPrice)}
                            </span>
                          </button>
                        ))}
                      </div>
                      {matchCount > suggestions.length && (
                        <p className="text-[12.5px] text-[#76777d] px-4 py-2.5 border-t border-[#c6c6cd]/40 bg-[#f8f9ff]">
                          Showing the first {MAX_VISIBLE_ITEMS} of{" "}
                          {matchCount.toLocaleString("en-ZA")} items — type a
                          few letters to narrow the list.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Line-item table */}
                <div className="pt-2 pb-1.5">
                  <div className="grid grid-cols-[minmax(220px,1fr)_110px_168px_90px_130px_96px] gap-3 items-center px-5 pt-3 pb-2.5">
                    {[
                      "Item",
                      "Price",
                      "Quantity",
                      "Discount",
                      "Line total",
                      "",
                    ].map((h, i) => (
                      <p
                        key={i}
                        className={`text-[11px] font-semibold uppercase tracking-[0.05em] text-[#45464d] ${
                          i === 1 || i === 3 || i === 4 ? "text-right" : ""
                        }`}
                      >
                        {h}
                      </p>
                    ))}
                  </div>

                  {lines.length === 0 && (
                    <div className="px-5 py-11 text-center border-t border-[#c6c6cd]/50">
                      <p className="text-[15px] text-[#76777d]">
                        <strong>No items yet.</strong> Use the search box above
                        to add your first item.
                      </p>
                    </div>
                  )}

                  {lines.map((l, i) => (
                    <div
                      // A quote loaded for revision can legitimately carry two
                      // lines with the same stock code — the index keeps keys
                      // unique.
                      key={`${l.code}-${i}`}
                      className="grid grid-cols-[minmax(220px,1fr)_110px_168px_90px_130px_96px] gap-3 items-center px-5 py-3.5 border-t border-[#c6c6cd]/50"
                    >
                      <div>
                        <p className="text-[15px] font-semibold text-[#0b1c30]">
                          {l.description}
                        </p>
                        <p className="font-mono text-[12px] text-[#76777d] mt-0.5">
                          {l.code}
                        </p>
                      </div>
                      <p className="text-[15px] text-[#45464d] tabular-nums text-right">
                        {fmtRand(l.price)}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label="One less"
                          onClick={() =>
                            updateLine(i, { qty: Math.max(1, l.qty - 1) })
                          }
                          className="w-11 h-11 rounded-lg border border-[#c6c6cd] bg-white text-[#0b1c30] flex items-center justify-center hover:bg-[#f8f9ff] hover:border-[#5bb8fe] hover:text-[#006398] transition-colors"
                        >
                          <Minus size={18} />
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={l.qty}
                          aria-label="Quantity"
                          onChange={(e) => {
                            const q = parseInt(e.target.value, 10);
                            updateLine(i, { qty: isNaN(q) || q < 1 ? 1 : q });
                          }}
                          className="w-14 h-11 text-center text-[16px] font-semibold border border-[#c6c6cd] rounded-lg text-[#0b1c30] tabular-nums focus:outline-none focus:border-[#0d9488] focus:ring-[3px] focus:ring-[#0d9488]/15"
                        />
                        <button
                          type="button"
                          aria-label="One more"
                          onClick={() => updateLine(i, { qty: l.qty + 1 })}
                          className="w-11 h-11 rounded-lg border border-[#c6c6cd] bg-white text-[#0b1c30] flex items-center justify-center hover:bg-[#f8f9ff] hover:border-[#5bb8fe] hover:text-[#006398] transition-colors"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={`${l.disc} %`}
                        aria-label="Discount percent"
                        onChange={(e) => {
                          const d = parseFloat(e.target.value.replace("%", ""));
                          updateLine(i, {
                            disc: isNaN(d) ? 0 : Math.min(100, Math.max(0, d)),
                          });
                        }}
                        className="w-full h-10 text-right text-[15px] px-2.5 border border-[#c6c6cd] rounded-lg text-[#45464d] tabular-nums focus:outline-none focus:border-[#0d9488] focus:ring-[3px] focus:ring-[#0d9488]/15"
                      />
                      <p className="text-[15.5px] font-semibold text-[#0b1c30] tabular-nums text-right">
                        {fmtRand(lineExclTotal(l))}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        className="h-10 px-3.5 rounded-lg border border-[#ba1a1a]/45 text-[#ba1a1a] bg-white text-[13.5px] font-medium hover:bg-[#ba1a1a] hover:text-white transition-colors justify-self-end"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </main>

            {/* ── Sticky totals footer bar ── */}
            <div className="bg-white border-t border-[#c6c6cd] shadow-[0_-8px_24px_-12px_rgba(11,28,48,0.18)] px-6 py-3.5 flex items-center gap-8 shrink-0">
              <div>
                <p className={labelCls}>Items subtotal</p>
                <p className="text-[16px] font-semibold text-[#0b1c30] tabular-nums">
                  {fmtRand(subtotal)}
                </p>
              </div>
              <div>
                <label className={labelCls} htmlFor="discAll">
                  Discount
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="discAll"
                    type="text"
                    inputMode="numeric"
                    value={`${discPercent} %`}
                    onChange={(e) => {
                      const d = parseFloat(e.target.value.replace("%", ""));
                      setDiscPercent(
                        isNaN(d) ? 0 : Math.min(100, Math.max(0, d)),
                      );
                    }}
                    className="w-[76px] h-10 text-right text-[15px] px-2.5 border border-[#c6c6cd] rounded-lg text-[#0b1c30] tabular-nums focus:outline-none focus:border-[#0d9488] focus:ring-[3px] focus:ring-[#0d9488]/15"
                  />
                  <span className="text-[12.5px] text-[#76777d] tabular-nums whitespace-nowrap">
                    − {fmtRand(discountAmount)}
                  </span>
                </div>
              </div>
              <div>
                <label className={labelCls} htmlFor="freight">
                  Delivery charge
                </label>
                <input
                  id="freight"
                  type="text"
                  inputMode="numeric"
                  value={fmtRand(freight)}
                  onChange={(e) => {
                    const f = parseFloat(
                      e.target.value.replace(/[R\s]/g, "").replace(",", "."),
                    );
                    setFreight(isNaN(f) || f < 0 ? 0 : f);
                  }}
                  className="w-[116px] h-10 text-right text-[15px] px-2.5 border border-[#c6c6cd] rounded-lg text-[#0b1c30] tabular-nums focus:outline-none focus:border-[#0d9488] focus:ring-[3px] focus:ring-[#0d9488]/15"
                />
              </div>
              <div>
                <p className={labelCls}>VAT (15%)</p>
                <p className="text-[16px] font-semibold text-[#0b1c30] tabular-nums">
                  {fmtRand(vatAmount)}
                </p>
              </div>
              <div className="w-px self-stretch bg-[#c6c6cd]" />
              <div>
                <p className={labelCls}>Total to quote</p>
                <p className="text-[28px] font-bold text-[#0b1c30] leading-tight tabular-nums tracking-tight">
                  {fmtRand(grandTotal)}
                </p>
              </div>
              <div className="flex-1 min-w-4">
                {saveError && (
                  <p className="text-[13px] text-[#ba1a1a] text-right">
                    {saveError}
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled
                title="Emailing quotes is coming soon — for now, save the quote and email it from Revelation."
                className="h-11 px-5 rounded-lg border border-[#c6c6cd] bg-white text-[#0b1c30] text-[15px] font-medium flex items-center gap-2 opacity-50 cursor-not-allowed"
              >
                <Mail size={16} /> Save &amp; Email to client
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="h-11 px-6 rounded-lg bg-[#0d9488] text-white text-[15px] font-semibold flex items-center gap-2 hover:bg-[#0b7c72] transition-colors disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Check size={16} />{" "}
                    {isEdit ? "Save as New Revision" : "Save Quote"}
                  </>
                )}
              </button>
            </div>
          </>
        )}

        <ConfirmCancelModal
          open={showCancelConfirm}
          docName="quote"
          onKeepEditing={() => setShowCancelConfirm(false)}
          onDiscard={discardAndLeave}
        />
      </div>
    </div>
  );
}
