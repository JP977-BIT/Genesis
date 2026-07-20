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
  Box,
  Clock,
  CreditCard,
  Download,
  Edit3,
  GripHorizontal,
  Info,
  Package,
  Percent,
  Tag,
  TrendingUp,
  Truck,
} from "lucide-react";
import FinanceSidebar from "@/app/Finance/components/financeSidebar";
import { useScrollSpy } from "@/app/Finance/hooks/useScrollSpy";
import { LazySection } from "@/app/Finance/components/LazySection";
import { SectionNav } from "@/app/Finance/components/SectionNav";

// ── Design tokens ─────────────────────────────────────────────────────────────
const labelCls =
  "text-[11px] font-semibold uppercase tracking-[0.05em] text-[#45464d]";

// ── Stable section list (defined outside component for referential stability) ─
const SECTION_IDS = [
  "details",
  "transactions",
  "pricing",
  "suppliers",
  "sales-info",
] as const;

const NAV_ITEMS = [
  { id: "details", label: "Details", icon: Info },
  { id: "transactions", label: "Transactions", icon: CreditCard },
  { id: "pricing", label: "Pricing", icon: Tag },
  { id: "suppliers", label: "Suppliers", icon: Truck },
  { id: "sales-info", label: "Sales Info", icon: TrendingUp },
] as const;

// ── Shared section order (localStorage key shared with SectionNav) ─────────
const SECTION_ORDER_KEY = "genesis-stock-nav-order";

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

// ── Nav dock position (persisted so the user's chosen dock sticks) ─────────
const DOCK_POSITION_KEY = "genesis-stock-nav-dock";
type DockPosition = "left" | "right" | "top" | "bottom";

function loadDockPosition(): DockPosition {
  try {
    const saved = localStorage.getItem(DOCK_POSITION_KEY);
    if (
      saved === "left" ||
      saved === "right" ||
      saved === "top" ||
      saved === "bottom"
    ) {
      return saved;
    }
  } catch {}
  return "top";
}

// ── Interfaces ────────────────────────────────────────────────────────────────
// Subset of Revelation's stockItem response that this page renders.
interface StockItemDetail {
  dbId: number;
  code: string;
  itemType: number;
  description: string;
  extendedDescription: string;
  cat: { id: number; code: string; name: string; markup: number } | null;
  exclPrice: number;
  inclPrice: number;
  avgCostPrice: number;
  latestCostPrice: number;
  listPrice: number;
  stdCost: number;
  promoPrcExcl: number;
  promoPrcIncl: number;
  saleStart: string;
  saleEnd: string;
  onPromation: boolean; // Revelation's own spelling
  taxCode: { code: string; name: string; taxRate: number } | null;
  onHand: number;
  available: number;
  salesOrders: number;
  purchaseOrders: number;
  workInProg: number;
  minLevel: number;
  maxLevel: number;
  reOrderQty: number;
  maxLineDisc: number;
  serialItem: boolean;
  allowPO: boolean;
  allowSO: boolean;
  frozen: boolean;
  nonPOSItem: boolean;
  noGrn: boolean;
  noAllowOnlineSales: boolean;
  notes: string;
  barcode: string;
  bin: { code: string; description: string } | null;
  unitSale: string;
  unitPurch: string;
  unitWeight: number;
  unitVolume: number;
  qtyDecml: string;
  prcDecml: string;
  guaranteePeriod: string;
  supplier1Code: string;
  supplier1AccNo: string;
  supplier1Name: string;
  supplier1ListPrice: number;
  supplier1LeadTime: number;
  supplier2Code: string;
  supplier2AccNo: string;
  supplier2Name: string;
  supplier2ListPrice: number;
  supplier2LeadTime: number;
  supplier3Code: string;
  supplier3AccNo: string;
  supplier3Name: string;
  supplier3ListPrice: number;
  supplier3LeadTime: number;
  supplier4Code: string;
  supplier4AccNo: string;
  supplier4Name: string;
  supplier4ListPrice: number;
  supplier4LeadTime: number;
  supplier5Code: string;
  supplier5AccNo: string;
  supplier5Name: string;
  supplier5ListPrice: number;
  supplier5LeadTime: number;
  salesMTD: number;
  salesCPMTD: number;
  salesSPMTD: number;
  salesPrfMTD: number;
  issueMTD: number;
  issueCPMTD: number;
  issueSPMTD: number;
  issuePrfMTD: number;
  salesYTD: number;
  salesCPYTD: number;
  salesSPYTD: number;
  salesPrfYTD: number;
  issueYTD: number;
  issueCPYTD: number;
  issueSPYTD: number;
  issuePrfYTD: number;
  lastPrchDate: string;
  lastPrchQty: number;
  lastSaleDate: string;
  lastSaleQty: number;
  lastIssueDate: string;
  lastIssueQty: number;
}

interface StockTransaction {
  sourceType: string;
  tranType: string;
  tranTypeName: string;
  date: string;
  accNo: string;
  accName: string;
  contra: string;
  contraName: string;
  ref: string;
  totalValue: number;
  tax: number;
  discount: number;
  statusName: string;
  user: string;
  warehouse: string;
  notes: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 });

const fmtQty = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("en-ZA");

// Revelation uses ancient placeholder dates (e.g. 1899) for "never".
const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime()) || d.getFullYear() < 1950) return "—";
  return d.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// ── Lazy data hook ────────────────────────────────────────────────────────────
// `enabled` comes from LazySection's hasBeenVisible latch: the fetch only
// starts once the section is about to enter the viewport.
function useStockTransactions(
  stockCode: string,
  companyNr: string | null,
  enabled: boolean,
) {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !companyNr) return;

    let active = true;
    setLoading(true);

    fetch(
      `/api/transactions/stock?companyNr=${companyNr}&stockCode=${encodeURIComponent(stockCode)}`,
    )
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
  }, [enabled, stockCode, companyNr]);

  return { transactions, loading };
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StockDetailPage() {
  const router = useRouter();
  const params = useParams();
  const code = decodeURIComponent(params.code as string);

  // ── Sidebar state ──
  const [isExpanded, setIsExpanded] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("sidebar-pinned") === "true",
  );
  const [activeNavItem, setActiveNavItem] = useState("Stock");

  // ── Company key ──
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

  // ── Stock item (eagerly fetched — needed for header immediately) ──
  const [item, setItem] = useState<StockItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Internal notes (seeded from the item once loaded) ──
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!code || !companyNr) return;

    let active = true;

    (async () => {
      try {
        const res = await fetch(
          `/api/stock/stockitem?companyNr=${companyNr}&stockItemCode=${encodeURIComponent(code)}`,
        );
        const result = await res.json();
        if (!active) return;

        const data = result?.data?.data?.stockItem;
        if (result.success && data) {
          setItem(data as StockItemDetail);
          setNotes((data as StockItemDetail).notes ?? "");
        } else {
          setError("Stock item not found.");
        }
      } catch {
        if (active) setError("Failed to load stock item.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [code, companyNr]);

  // ── Page-level section drag-to-reorder (dnd-kit) ──
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const pageSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handlePageDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handlePageDragEnd = useCallback((event: DragEndEvent) => {
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
  }, []);

  // ── Dockable nav panel — defaults to top (tab formation), persisted ──
  const [dockPosition, setDockPosition] = useState<DockPosition>(() =>
    typeof window !== "undefined" ? loadDockPosition() : "top",
  );
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
      if (snapTargetRef.current) {
        setDockPosition(snapTargetRef.current);
        localStorage.setItem(DOCK_POSITION_KEY, snapTargetRef.current);
      }
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
  const [mainEl, setMainEl] = useState<HTMLElement | null>(null);
  const { activeSection, scrollToSection } = useScrollSpy(sectionOrder, mainEl);

  // ── Section content renderer ──────────────────────────────────────────────
  const renderSectionContent = (id: string) => {
    if (!item) return null;

    switch (id) {
      case "details":
        return (
          <LazySection id="details">
            {() => (
              <DetailsSection item={item} notes={notes} setNotes={setNotes} />
            )}
          </LazySection>
        );

      case "transactions":
        return (
          <LazySection id="transactions">
            {(enabled) => (
              <TransactionsSection
                stockCode={item.code}
                companyNr={companyNr}
                enabled={enabled}
              />
            )}
          </LazySection>
        );

      case "pricing":
        return (
          <LazySection id="pricing">
            {() => <PricingSection item={item} />}
          </LazySection>
        );

      case "suppliers":
        return (
          <LazySection id="suppliers">
            {() => <SuppliersSection item={item} />}
          </LazySection>
        );

      case "sales-info":
        return (
          <LazySection id="sales-info">
            {() => <SalesInfoSection item={item} />}
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
        navigateOnSelect
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* ── Loading state ── */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-[#76777d]">Loading stock item…</p>
          </div>
        )}

        {/* ── Error state ── */}
        {error && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <p className="text-sm text-[#ba1a1a]">{error}</p>
            <button
              onClick={() => router.push("/Finance?view=Stock")}
              className="h-8 px-4 rounded border border-[#c6c6cd] bg-white text-[#0b1c30] text-sm font-medium flex items-center gap-1.5 hover:bg-[#f8f9ff] transition-colors"
            >
              <ArrowLeft size={14} /> Back to Stock
            </button>
          </div>
        )}

        {item && !loading && !error && (
          <>
            {/* ── Item header ── */}
            <header className="bg-white border-b border-[#c6c6cd] px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push("/Finance?view=Stock")}
                  className="w-8 h-8 rounded border border-[#c6c6cd] bg-white flex items-center justify-center text-[#45464d] hover:bg-[#f8f9ff] hover:text-[#0b1c30] transition-colors shrink-0"
                  title="Back to Stock"
                >
                  <ArrowLeft size={15} />
                </button>
                <div className="w-px h-6 bg-[#c6c6cd]/60 shrink-0" />
                <div className="w-10 h-10 rounded bg-[#e8eaf0] flex items-center justify-center shrink-0">
                  <Package size={20} className="text-[#45464d]" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="font-semibold text-[16px] text-[#0b1c30]">
                      {item.description?.trim() || item.code}
                    </h1>
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                        item.frozen
                          ? "bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/25"
                          : "bg-[#009668]/10 text-[#009668] border-[#009668]/25"
                      }`}
                    >
                      {item.frozen ? "Frozen" : "Active"}
                    </span>
                    {item.onPromation && (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border bg-[#F59E0B]/10 text-[#b45309] border-[#F59E0B]/30">
                        On Promotion
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-[#45464d] mt-0.5">
                    {item.code}
                    {item.cat?.name?.trim() ? ` · ${item.cat.name}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="h-8 px-4 rounded border border-[#c6c6cd] bg-white text-[#0b1c30] text-sm font-medium flex items-center gap-1.5 hover:bg-[#f8f9ff] transition-colors">
                  <Download size={14} /> Export
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

// Shared card shell + field row used by the detail cards below
function Card({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-[#c6c6cd] shadow-[0px_1px_2px_rgba(15,23,42,0.05)] p-5 flex flex-col">
      <div className="flex items-center gap-3 pb-4 border-b border-[#c6c6cd]/40">
        <div className="w-9 h-9 rounded-lg bg-[#0d9488]/10 border border-[#0d9488]/20 flex items-center justify-center text-[#0d9488] shrink-0">
          <Icon size={16} />
        </div>
        <h3 className="text-[15px] font-semibold text-[#0b1c30]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] text-[#76777d] mb-0.5">{label}</p>
      <p className="text-[15px] font-semibold text-[#0b1c30]">{value}</p>
    </div>
  );
}

function YesNo({ value }: { value: boolean }) {
  return (
    <span
      className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
        value
          ? "bg-[#009668]/10 text-[#009668] border-[#009668]/20"
          : "bg-[#f8f9ff] text-[#76777d] border-[#c6c6cd]"
      }`}
    >
      {value ? "Yes" : "No"}
    </span>
  );
}

function DetailsSection({
  item,
  notes,
  setNotes,
}: {
  item: StockItemDetail;
  notes: string;
  setNotes: React.Dispatch<React.SetStateAction<string>>;
}) {
  const heroStats = [
    { label: "ON HAND", value: fmtQty(item.onHand), color: "text-[#0b1c30]" },
    {
      label: "AVAILABLE",
      value: fmtQty(item.available),
      color: item.available > 0 ? "text-[#009668]" : "text-[#ba1a1a]",
    },
    {
      label: "SALES ORDERS",
      value: fmtQty(item.salesOrders),
      color: "text-[#0b1c30]",
    },
    {
      label: "PURCHASE ORDERS",
      value: fmtQty(item.purchaseOrders),
      color: "text-[#0b1c30]",
    },
  ];

  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-[15px] font-semibold text-[#0b1c30] mb-4">
          Details
        </h2>
        <div className="flex divide-x divide-[#c6c6cd]">
          {heroStats.map((stat, i) => (
            <div
              key={stat.label}
              className={
                i === 0
                  ? "pr-12"
                  : i === heroStats.length - 1
                    ? "pl-12"
                    : "px-12"
              }
            >
              <p className={`${labelCls} mb-1.5`}>{stat.label}</p>
              <p
                className={`text-[30px] font-bold leading-none ${stat.color}`}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-3 gap-4">
        <Card icon={Info} title="Item information">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 pt-4">
            <Field label="Code" value={item.code} />
            <Field label="Barcode" value={item.barcode?.trim() || "—"} />
            <Field label="Category" value={item.cat?.name?.trim() || "—"} />
            <Field
              label="Bin location"
              value={item.bin?.code?.trim() || "—"}
            />
            <Field
              label="Extended description"
              value={item.extendedDescription?.trim() || "—"}
            />
            <Field
              label="Guarantee period"
              value={item.guaranteePeriod?.trim() || "—"}
            />
          </div>
        </Card>

        <Card icon={BarChart2} title="Stock levels">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 pt-4">
            <Field label="Minimum level" value={fmtQty(item.minLevel)} />
            <Field label="Maximum level" value={fmtQty(item.maxLevel)} />
            <Field label="Re-order quantity" value={fmtQty(item.reOrderQty)} />
            <Field label="Work in progress" value={fmtQty(item.workInProg)} />
            <Field label="On hand" value={fmtQty(item.onHand)} />
            <Field label="Available" value={fmtQty(item.available)} />
          </div>
        </Card>

        <Card icon={Edit3} title="Internal notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add internal notes about this item…"
            className="flex-1 w-full resize-none text-[14px] text-[#0b1c30] placeholder:text-[#b0b1b8] focus:outline-none leading-relaxed min-h-[180px] pt-4"
          />
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#c6c6cd]/40">
            <p className="text-[11px] text-[#b0b1b8]">
              {notes.length > 0 ? `${notes.length} characters` : "No notes yet"}
            </p>
            <button
              onClick={() => alert("Notes saving coming soon!")}
              className="h-7 px-3 rounded bg-[#0b1c30] text-white text-[12px] font-medium hover:bg-[#131b2e] transition-colors"
            >
              Save Notes
            </button>
          </div>
        </Card>

        <Card icon={Box} title="Units &amp; measures">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 pt-4">
            <Field label="Unit of sale" value={item.unitSale?.trim() || "—"} />
            <Field
              label="Unit of purchase"
              value={item.unitPurch?.trim() || "—"}
            />
            <Field label="Unit weight" value={fmt(item.unitWeight)} />
            <Field label="Unit volume" value={fmt(item.unitVolume)} />
            <Field
              label="Quantity decimals"
              value={item.qtyDecml?.trim() || "—"}
            />
            <Field
              label="Price decimals"
              value={item.prcDecml?.trim() || "—"}
            />
          </div>
        </Card>

        <Card icon={Clock} title="Item settings">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 pt-4">
            <Field label="Serial item" value={<YesNo value={item.serialItem} />} />
            <Field
              label="Allow purchase orders"
              value={<YesNo value={item.allowPO} />}
            />
            <Field
              label="Allow sales orders"
              value={<YesNo value={item.allowSO} />}
            />
            <Field
              label="POS item"
              value={<YesNo value={!item.nonPOSItem} />}
            />
            <Field
              label="Allow GRN"
              value={<YesNo value={!item.noGrn} />}
            />
            <Field
              label="Online sales"
              value={<YesNo value={!item.noAllowOnlineSales} />}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function PricingSection({ item }: { item: StockItemDetail }) {
  return (
    <div className="space-y-5">
      <h2 className="text-[15px] font-semibold text-[#0b1c30]">Pricing</h2>

      <div className="flex divide-x divide-[#c6c6cd]">
        <div className="pr-12">
          <p className={`${labelCls} mb-1.5`}>SELLING PRICE (EXCL)</p>
          <p className="text-[30px] font-bold text-[#0b1c30] leading-none">
            {fmt(item.exclPrice)}
          </p>
        </div>
        <div className="px-12">
          <p className={`${labelCls} mb-1.5`}>SELLING PRICE (INCL)</p>
          <p className="text-[30px] font-bold text-[#0b1c30] leading-none">
            {fmt(item.inclPrice)}
          </p>
        </div>
        <div className="pl-12">
          <p className={`${labelCls} mb-1.5`}>AVERAGE COST</p>
          <p className="text-[30px] font-bold text-[#009668] leading-none">
            {fmt(item.avgCostPrice)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card icon={Tag} title="Selling prices">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 pt-4">
            <Field label="Excl price" value={fmt(item.exclPrice)} />
            <Field label="Incl price" value={fmt(item.inclPrice)} />
            <Field label="List price" value={fmt(item.listPrice)} />
            <Field
              label="Max line discount"
              value={
                item.maxLineDisc > 0 ? `${fmt(item.maxLineDisc)}%` : "—"
              }
            />
          </div>
        </Card>

        <Card icon={Percent} title="Costs &amp; tax">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 pt-4">
            <Field label="Average cost" value={fmt(item.avgCostPrice)} />
            <Field label="Latest cost" value={fmt(item.latestCostPrice)} />
            <Field label="Standard cost" value={fmt(item.stdCost)} />
            <Field
              label="Category markup"
              value={item.cat ? `${fmt(item.cat.markup)}%` : "—"}
            />
            <Field label="Tax code" value={item.taxCode?.code?.trim() || "—"} />
            <Field
              label="Tax rate"
              value={item.taxCode ? `${fmt(item.taxCode.taxRate)}%` : "—"}
            />
          </div>
        </Card>

        <Card icon={TrendingUp} title="Promotion">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 pt-4">
            <Field
              label="On promotion"
              value={<YesNo value={item.onPromation} />}
            />
            <Field label="Promo price (excl)" value={fmt(item.promoPrcExcl)} />
            <Field label="Promo price (incl)" value={fmt(item.promoPrcIncl)} />
            <Field label="Sale start" value={fmtDate(item.saleStart)} />
            <Field label="Sale end" value={fmtDate(item.saleEnd)} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function SuppliersSection({ item }: { item: StockItemDetail }) {
  const suppliers = [
    {
      code: item.supplier1Code,
      accNo: item.supplier1AccNo,
      name: item.supplier1Name,
      listPrice: item.supplier1ListPrice,
      leadTime: item.supplier1LeadTime,
    },
    {
      code: item.supplier2Code,
      accNo: item.supplier2AccNo,
      name: item.supplier2Name,
      listPrice: item.supplier2ListPrice,
      leadTime: item.supplier2LeadTime,
    },
    {
      code: item.supplier3Code,
      accNo: item.supplier3AccNo,
      name: item.supplier3Name,
      listPrice: item.supplier3ListPrice,
      leadTime: item.supplier3LeadTime,
    },
    {
      code: item.supplier4Code,
      accNo: item.supplier4AccNo,
      name: item.supplier4Name,
      listPrice: item.supplier4ListPrice,
      leadTime: item.supplier4LeadTime,
    },
    {
      code: item.supplier5Code,
      accNo: item.supplier5AccNo,
      name: item.supplier5Name,
      listPrice: item.supplier5ListPrice,
      leadTime: item.supplier5LeadTime,
    },
  ].filter((s) => s.code?.trim() || s.accNo?.trim() || s.name?.trim());

  return (
    <div className="space-y-5">
      <h2 className="text-[15px] font-semibold text-[#0b1c30]">Suppliers</h2>

      {suppliers.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#c6c6cd] py-16 text-center">
          <p className="text-sm text-[#76777d]">
            No suppliers linked to this item
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-[#c6c6cd] shadow-[0px_1px_2px_rgba(15,23,42,0.05)] overflow-hidden">
          <div className="grid grid-cols-[60px_140px_140px_1fr_140px_120px] gap-3 bg-[#f8f9ff] border-b border-[#c6c6cd] px-4 py-2.5">
            <p className={labelCls}>#</p>
            <p className={labelCls}>Code</p>
            <p className={labelCls}>Account</p>
            <p className={labelCls}>Name</p>
            <p className={`${labelCls} text-right`}>List Price</p>
            <p className={`${labelCls} text-right`}>Lead Time</p>
          </div>
          {suppliers.map((s, i) => (
            <div
              key={`${s.code}-${i}`}
              className="grid grid-cols-[60px_140px_140px_1fr_140px_120px] gap-3 px-4 py-3 items-center border-b border-[#c6c6cd]/50 last:border-0"
            >
              <span className="text-[13px] text-[#76777d]">{i + 1}</span>
              <span className="text-[13px] text-[#45464d] truncate">
                {s.code?.trim() || "—"}
              </span>
              <span className="text-[13px] text-[#45464d] truncate">
                {s.accNo?.trim() || "—"}
              </span>
              <span className="text-[13px] font-medium text-[#0b1c30] truncate">
                {s.name?.trim() || "—"}
              </span>
              <span className="text-[13px] font-semibold text-[#0b1c30] text-right">
                {fmt(s.listPrice)}
              </span>
              <span className="text-[13px] text-[#45464d] text-right">
                {s.leadTime > 0 ? `${s.leadTime} days` : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Stock-in movements (purchases/receipts) show green; stock-out (sales/issues) blue.
const isInboundType = (name: string) => /grn|purch|receipt|return/i.test(name);
const isOutboundType = (name: string) => /invoice|issue|sale/i.test(name);

function TransactionsSection({
  stockCode,
  companyNr,
  enabled,
}: {
  stockCode: string;
  companyNr: string | null;
  enabled: boolean;
}) {
  const { transactions, loading } = useStockTransactions(
    stockCode,
    companyNr,
    enabled,
  );
  const [txFilter, setTxFilter] = useState("All");

  const totalValue = transactions.reduce((s, t) => s + t.totalValue, 0);
  const totalTax = transactions.reduce((s, t) => s + t.tax, 0);

  return (
    <div className="space-y-5">
      <h2 className="text-[15px] font-semibold text-[#0b1c30]">Transactions</h2>

      {/* Summary */}
      <div className="flex divide-x divide-[#c6c6cd]">
        <div className="pr-12">
          <p className={`${labelCls} mb-1.5`}>TRANSACTIONS</p>
          <p className="text-[30px] font-bold text-[#0b1c30] leading-none">
            {loading ? "—" : fmtQty(transactions.length)}
          </p>
        </div>
        <div className="px-12">
          <p className={`${labelCls} mb-1.5`}>TOTAL VALUE</p>
          <p className="text-[30px] font-bold text-[#0b1c30] leading-none">
            {loading ? "—" : fmt(totalValue)}
          </p>
        </div>
        <div className="pl-12">
          <p className={`${labelCls} mb-1.5`}>TOTAL TAX</p>
          <p className="text-[30px] font-bold text-[#009668] leading-none">
            {loading ? "—" : fmt(totalTax)}
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
      {loading ? (
        <div className="bg-white rounded-lg border border-[#c6c6cd] py-16 text-center">
          <p className="text-sm text-[#76777d]">Loading transactions…</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#c6c6cd] py-16 text-center">
          <p className="text-sm text-[#76777d]">
            No transactions found for this item
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-[#c6c6cd] shadow-[0px_1px_2px_rgba(15,23,42,0.05)] overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[110px_185px_1fr_1fr_110px_130px_100px] gap-3 bg-[#f8f9ff] border-b border-[#c6c6cd] px-4 py-2.5">
            <p className={labelCls}>Date</p>
            <p className={labelCls}>Type</p>
            <p className={labelCls}>Ref</p>
            <p className={labelCls}>Account</p>
            <p className={labelCls}>Warehouse</p>
            <p className={`${labelCls} text-right`}>Amount</p>
            <p className={labelCls}>Status</p>
          </div>

          {/* Data rows */}
          {transactions
            .filter((t) => txFilter === "All" || t.tranTypeName === txFilter)
            .map((tx, idx) => {
              const isIn = isInboundType(tx.tranTypeName);
              const isOut = isOutboundType(tx.tranTypeName);

              return (
                <div
                  key={tx.ref + idx}
                  className="grid grid-cols-[110px_185px_1fr_1fr_110px_130px_100px] gap-3 px-4 py-3 items-center border-b border-[#c6c6cd]/50 last:border-0"
                >
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
                        isIn
                          ? "bg-[#009668]/10 text-[#009668] border-[#009668]/20"
                          : isOut
                            ? "bg-[#eff4ff] text-[#006398] border-[#006398]/20"
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
                    {tx.contraName || tx.accName || tx.notes || "—"}
                  </span>
                  <span className="text-[13px] text-[#45464d] truncate">
                    {tx.warehouse?.trim() || "—"}
                  </span>
                  <span className="flex justify-end items-center text-[13px] font-semibold text-[#0b1c30]">
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
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

function SalesInfoSection({ item }: { item: StockItemDetail }) {
  const rows = [
    {
      label: "Sales MTD",
      qty: item.salesMTD,
      value: item.salesSPMTD,
      cost: item.salesCPMTD,
      profit: item.salesPrfMTD,
    },
    {
      label: "Sales YTD",
      qty: item.salesYTD,
      value: item.salesSPYTD,
      cost: item.salesCPYTD,
      profit: item.salesPrfYTD,
    },
    {
      label: "Issues MTD",
      qty: item.issueMTD,
      value: item.issueSPMTD,
      cost: item.issueCPMTD,
      profit: item.issuePrfMTD,
    },
    {
      label: "Issues YTD",
      qty: item.issueYTD,
      value: item.issueSPYTD,
      cost: item.issueCPYTD,
      profit: item.issuePrfYTD,
    },
  ];

  const movements = [
    { label: "Last purchase", date: item.lastPrchDate, qty: item.lastPrchQty },
    { label: "Last sale", date: item.lastSaleDate, qty: item.lastSaleQty },
    { label: "Last issue", date: item.lastIssueDate, qty: item.lastIssueQty },
  ];

  return (
    <div className="space-y-5">
      <h2 className="text-[15px] font-semibold text-[#0b1c30]">Sales Info</h2>

      <div className="flex divide-x divide-[#c6c6cd]">
        <div className="pr-12">
          <p className={`${labelCls} mb-1.5`}>SALES YTD</p>
          <p className="text-[30px] font-bold text-[#0b1c30] leading-none">
            {fmt(item.salesSPYTD)}
          </p>
        </div>
        <div className="px-12">
          <p className={`${labelCls} mb-1.5`}>PROFIT YTD</p>
          <p className="text-[30px] font-bold text-[#009668] leading-none">
            {fmt(item.salesPrfYTD)}
          </p>
        </div>
        <div className="pl-12">
          <p className={`${labelCls} mb-1.5`}>SALES MTD</p>
          <p className="text-[30px] font-bold text-[#0b1c30] leading-none">
            {fmt(item.salesSPMTD)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#c6c6cd] shadow-[0px_1px_2px_rgba(15,23,42,0.05)] overflow-hidden">
        <div className="grid grid-cols-[1fr_140px_160px_160px_160px] gap-3 bg-[#f8f9ff] border-b border-[#c6c6cd] px-4 py-2.5">
          <p className={labelCls}>Period</p>
          <p className={`${labelCls} text-right`}>Qty</p>
          <p className={`${labelCls} text-right`}>Value</p>
          <p className={`${labelCls} text-right`}>Cost</p>
          <p className={`${labelCls} text-right`}>Profit</p>
        </div>
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[1fr_140px_160px_160px_160px] gap-3 px-4 py-3 items-center border-b border-[#c6c6cd]/50 last:border-0"
          >
            <span className="text-[13px] font-medium text-[#0b1c30]">
              {row.label}
            </span>
            <span className="text-[13px] text-[#45464d] text-right">
              {fmtQty(row.qty)}
            </span>
            <span className="text-[13px] font-semibold text-[#0b1c30] text-right">
              {fmt(row.value)}
            </span>
            <span className="text-[13px] text-[#45464d] text-right">
              {fmt(row.cost)}
            </span>
            <span
              className={`text-[13px] font-semibold text-right ${
                row.profit >= 0 ? "text-[#009668]" : "text-[#ba1a1a]"
              }`}
            >
              {fmt(row.profit)}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {movements.map((m) => (
          <div
            key={m.label}
            className="bg-white rounded-lg border border-[#c6c6cd] shadow-[0px_1px_2px_rgba(15,23,42,0.05)] p-5"
          >
            <p className={`${labelCls} mb-1.5`}>{m.label.toUpperCase()}</p>
            <p className="text-[20px] font-bold text-[#0b1c30] leading-none">
              {fmtDate(m.date)}
            </p>
            <p className="text-[12px] text-[#76777d] mt-2">
              Quantity: {fmtQty(m.qty)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
