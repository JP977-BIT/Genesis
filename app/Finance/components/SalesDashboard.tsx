"use client";

// Modelled on app/Finance/clients/[accNo]/page.tsx for card style, color tokens,
// and labelCls. Uses recharts for the payment-mix donut.

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { useTranTotals } from "@/src/lib/hooks/useTranTotals";

// ── Design-system constants (matching page.tsx) ───────────────────────────────
const labelCls =
  "text-[11px] font-semibold uppercase tracking-[0.05em] text-[#45464d]";

const cardCls =
  "bg-white rounded-lg border border-[#c6c6cd] shadow-[0px_1px_2px_rgba(15,23,42,0.05)]";

// Formats a number as South African Rand, matching the fmt() helper used
// throughout the Finance module.
const fmt = (n: number) =>
  "R " + n.toLocaleString("en-ZA", { minimumFractionDigits: 2 });

// ── Payment-mix chart colours ─────────────────────────────────────────────────
const PAYMENT_COLORS: Record<string, string> = {
  Cash: "#006398",
  Cheques: "#009668",
  "Credit Cards": "#8b5cf6",
  EFT: "#F59E0B",
  Vouchers: "#ef4444",
  Other: "#94a3b8",
};

// ── Skeleton helpers ──────────────────────────────────────────────────────────
function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`${cardCls} p-5 animate-pulse ${className}`}
    >
      <div className="h-3 w-24 bg-[#e8eaf0] rounded mb-4" />
      <div className="h-8 w-32 bg-[#e8eaf0] rounded mb-2" />
      <div className="h-2 w-16 bg-[#e8eaf0] rounded" />
    </div>
  );
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`${cardCls} p-5 animate-pulse ${className}`}>
      <div className="h-3 w-32 bg-[#e8eaf0] rounded mb-5" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 bg-[#e8eaf0] rounded" />
        ))}
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface SalesDashboardProps {
  companyNr: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SalesDashboard({ companyNr }: SalesDashboardProps) {
  const { rows, loading, error, refetch } = useTranTotals(companyNr);

  // ── Aggregations (all derived from the per-operator rows) ─────────────────
  const stats = useMemo(() => {
    const sum = (key: keyof typeof rows[0]) =>
      rows.reduce((s, r) => s + (r[key] as number), 0);

    const totalDay = sum("dayTotal");
    const totalMonth = sum("monthTotal");
    const totalYear = sum("yearTotal");
    const totalLastYear = sum("lastYearTotal");
    const yoyPct =
      totalLastYear > 0
        ? ((totalYear - totalLastYear) / totalLastYear) * 100
        : null;

    const paymentMix = [
      { name: "Cash", value: sum("userCash") },
      { name: "Cheques", value: sum("userCheques") },
      { name: "Credit Cards", value: sum("userCreditCards") },
      { name: "EFT", value: sum("userEFT") },
      { name: "Vouchers", value: sum("userVouchers") },
      { name: "Other", value: sum("userOther") },
    ].filter((d) => d.value > 0);

    const operators = [...rows].sort((a, b) => b.monthTotal - a.monthTotal);
    const topOperatorMonth =
      operators.length > 0 ? operators[0].monthTotal : 1;

    const totalInvoices = sum("userInvoices");
    const totalCreditNotes = sum("userCreditNotes");
    const totalCashSales = sum("userCashSales");
    const totalCashRefunds = sum("userCashRefunds");

    const cashupDone = rows.filter((r) => r.cashupDone).length;
    const cashupPending = rows.length - cashupDone;

    const settleDisc = sum("userSettleDisc");
    const tradeDisc = sum("userTradeDisc");
    const totalDisc = settleDisc + tradeDisc;

    return {
      totalDay, totalMonth, totalYear, totalLastYear, yoyPct,
      paymentMix,
      operators, topOperatorMonth,
      totalInvoices, totalCreditNotes, totalCashSales, totalCashRefunds,
      cashupDone, cashupPending,
      settleDisc, tradeDisc, totalDisc,
    };
  }, [rows]);

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-[#ba1a1a]">{error}</p>
        <button
          onClick={refetch}
          className="h-8 px-4 rounded border border-[#c6c6cd] bg-white text-[#0b1c30] text-sm font-medium flex items-center gap-1.5 hover:bg-[#f8f9ff] transition-colors"
        >
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    );
  }

  // ── Loading state (skeleton grid) ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4 p-1">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <SkeletonBlock className="col-span-1 h-72" />
          <SkeletonBlock className="col-span-2 h-72" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <SkeletonBlock className="h-48" />
          <SkeletonBlock className="h-48" />
          <SkeletonBlock className="h-48" />
        </div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 overflow-y-auto h-full pb-4 font-body">

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[17px] font-semibold text-[#0b1c30]">
          Sales Overview
        </h1>
        <button
          onClick={refetch}
          className="h-7 px-3 rounded border border-[#c6c6cd] bg-white text-[#0b1c30] text-[12px] font-medium flex items-center gap-1.5 hover:bg-[#f8f9ff] transition-colors"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* ── Row 1: KPI cards ── */}
      <div className="grid grid-cols-4 gap-4">
        {/* Today */}
        <div className={`${cardCls} p-5`}>
          <p className={`${labelCls} mb-2`}>Today</p>
          <p className="font-data text-[26px] font-bold text-[#0b1c30] leading-none">
            {fmt(stats.totalDay)}
          </p>
        </div>

        {/* This Month */}
        <div className={`${cardCls} p-5`}>
          <p className={`${labelCls} mb-2`}>This Month</p>
          <p className="font-data text-[26px] font-bold text-[#0b1c30] leading-none">
            {fmt(stats.totalMonth)}
          </p>
        </div>

        {/* This Year */}
        <div className={`${cardCls} p-5`}>
          <p className={`${labelCls} mb-2`}>This Year</p>
          <p className="font-data text-[26px] font-bold text-[#0b1c30] leading-none">
            {fmt(stats.totalYear)}
          </p>
        </div>

        {/* Year-on-Year */}
        <div className={`${cardCls} p-5`}>
          <p className={`${labelCls} mb-2`}>Year-on-Year</p>
          {stats.yoyPct === null ? (
            <p className="font-data text-[26px] font-bold text-[#76777d] leading-none">
              —
            </p>
          ) : (
            <div className="flex items-end gap-2">
              <p
                className={`font-data text-[26px] font-bold leading-none ${
                  stats.yoyPct >= 0 ? "text-[#009668]" : "text-[#ba1a1a]"
                }`}
              >
                {stats.yoyPct >= 0 ? "+" : ""}
                {stats.yoyPct.toFixed(1)}%
              </p>
              {stats.yoyPct >= 0 ? (
                <TrendingUp size={18} className="text-[#009668] mb-0.5" />
              ) : (
                <TrendingDown size={18} className="text-[#ba1a1a] mb-0.5" />
              )}
            </div>
          )}
          <p className="text-[11px] text-[#76777d] mt-1.5">
            vs {fmt(stats.totalLastYear)} last year
          </p>
        </div>
      </div>

      {/* ── Row 2: Payment mix + Operator leaderboard ── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Payment method donut */}
        <div className={`${cardCls} p-5`}>
          <h2 className="text-[14px] font-semibold text-[#0b1c30] mb-4">
            Payment Mix
          </h2>
          {stats.paymentMix.length === 0 ? (
            <p className="text-sm text-[#76777d] py-8 text-center">
              No payment data
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={stats.paymentMix}
                  cx="50%"
                  cy="50%"
                  // innerRadius makes it a donut; outerRadius keeps it compact.
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {stats.paymentMix.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={PAYMENT_COLORS[entry.name] ?? "#94a3b8"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => fmt(Number(value ?? 0))}
                  contentStyle={{
                    fontSize: 12,
                    border: "1px solid #c6c6cd",
                    borderRadius: 6,
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Operator leaderboard */}
        <div className={`${cardCls} p-5 col-span-2`}>
          <h2 className="text-[14px] font-semibold text-[#0b1c30] mb-4">
            Operator Leaderboard — Month
          </h2>
          {stats.operators.length === 0 ? (
            <p className="text-sm text-[#76777d] py-8 text-center">
              No operator data
            </p>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[220px] pr-1">
              {stats.operators.map((op, i) => {
                const pct =
                  stats.topOperatorMonth > 0
                    ? (op.monthTotal / stats.topOperatorMonth) * 100
                    : 0;
                return (
                  <div key={op.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-[#76777d] w-5 text-right">
                          {i + 1}
                        </span>
                        <span className="text-[13px] text-[#0b1c30] font-medium truncate max-w-[200px]">
                          {op.name || op.code}
                        </span>
                      </div>
                      <span className="font-data text-[12px] text-[#45464d] shrink-0">
                        {fmt(op.monthTotal)}
                      </span>
                    </div>
                    {/* Inline progress bar showing relative contribution */}
                    <div className="h-1.5 bg-[#f0f2f8] rounded-full overflow-hidden ml-7">
                      <div
                        className="h-full bg-[#006398] rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Documents | Cashup status | Discounts ── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Documents summary */}
        <div className={`${cardCls} p-5`}>
          <h2 className="text-[14px] font-semibold text-[#0b1c30] mb-4">
            Documents
          </h2>
          <div className="space-y-3">
            {[
              { label: "Invoices",      value: stats.totalInvoices,    color: "text-[#006398]" },
              { label: "Credit Notes",  value: stats.totalCreditNotes, color: "text-[#ba1a1a]" },
              { label: "Cash Sales",    value: stats.totalCashSales,   color: "text-[#009668]" },
              { label: "Cash Refunds",  value: stats.totalCashRefunds, color: "text-[#F59E0B]" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="flex items-center justify-between py-2 border-b border-[#c6c6cd]/40 last:border-0"
              >
                <p className={labelCls}>{label}</p>
                <p className={`font-data text-[15px] font-semibold ${color}`}>
                  {value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Cashup status */}
        <div className={`${cardCls} p-5`}>
          <h2 className="text-[14px] font-semibold text-[#0b1c30] mb-4">
            Cashup Status
          </h2>
          <div className="flex items-center gap-6 mb-5">
            <div className="text-center">
              <p className="font-data text-[34px] font-bold text-[#009668] leading-none">
                {stats.cashupDone}
              </p>
              <p className={`${labelCls} mt-1`}>Done</p>
            </div>
            <div className="w-px h-10 bg-[#c6c6cd]" />
            <div className="text-center">
              <p className="font-data text-[34px] font-bold text-[#F59E0B] leading-none">
                {stats.cashupPending}
              </p>
              <p className={`${labelCls} mt-1`}>Pending</p>
            </div>
          </div>
          {/* Visual completion bar */}
          {rows.length > 0 && (
            <div>
              <div className="flex justify-between mb-1">
                <p className={labelCls}>Completion</p>
                <p className="text-[11px] font-semibold text-[#45464d]">
                  {Math.round((stats.cashupDone / rows.length) * 100)}%
                </p>
              </div>
              <div className="h-2 bg-[#f0f2f8] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#009668] rounded-full transition-all"
                  style={{
                    width: `${(stats.cashupDone / rows.length) * 100}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-[#76777d] mt-1.5">
                {rows.length} operator{rows.length !== 1 ? "s" : ""} total
              </p>
            </div>
          )}
        </div>

        {/* Discounts given */}
        <div className={`${cardCls} p-5`}>
          <h2 className="text-[14px] font-semibold text-[#0b1c30] mb-4">
            Discounts Given
          </h2>
          <p className="font-data text-[28px] font-bold text-[#ba1a1a] leading-none mb-4">
            {fmt(stats.totalDisc)}
          </p>
          <div className="space-y-3 border-t border-[#c6c6cd]/40 pt-4">
            <div className="flex items-center justify-between">
              <p className={labelCls}>Settlement Disc.</p>
              <p className="font-data text-[13px] text-[#45464d]">
                {fmt(stats.settleDisc)}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className={labelCls}>Trade Disc.</p>
              <p className="font-data text-[13px] text-[#45464d]">
                {fmt(stats.tradeDisc)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
