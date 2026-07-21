"use client";

// Read-only pop-up of one full quote (header / line items / totals footer),
// opened from the Quotes section list. Modal shell modelled on
// EditClientModal.tsx; money formatting matches the quote editor's fmtRand.

import { useEffect, useState } from "react";
import { X, FileText, Pencil } from "lucide-react";

const labelCls =
  "text-[11px] font-semibold uppercase tracking-[0.05em] text-[#45464d]";

// Labels for Revelation's numeric codes — mirrors STATUSES / DELIVERY_METHODS
// in quote/components/QuoteEditor.tsx (kept here so the client page doesn't
// pull the whole editor into its bundle).
export const QUOTE_STATUS_LABELS: Record<number, string> = {
  0: "Draft",
  1: "Sent to client",
  2: "Accepted",
  3: "Declined",
  4: "Expired",
};

const DELIVERY_METHOD_LABELS: Record<number, string> = {
  0: "We deliver",
  1: "Client collects",
  2: "Courier",
};

const fmtRand = (n: number) =>
  "R " +
  n.toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-ZA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

// Full quote from /api/quotes/quote — only what this modal displays.
interface FullQuoteLine {
  lineNo: number;
  stockcode: string;
  description: string;
  price: number;
  quantity: number;
  discPercent: number;
  exclTotal: number;
}

interface FullQuote {
  quoteNo: string;
  accNo: string;
  accName: string;
  notes: string | null;
  repCode: string | null;
  deliveryAddress1: string | null;
  deliveryAddress2: string | null;
  deliveryAddress3: string | null;
  deliveryAddress4: string | null;
  deliveryAddress5: string | null;
  date: string;
  expiryDate: string | null;
  expectedDate: string | null;
  discount: number;
  goodsValue: number;
  freight: number;
  tax: number;
  total: number;
  deliveryMethod: number;
  status: number;
  body: FullQuoteLine[];
}

interface QuoteDetailModalProps {
  // The quote to show — null keeps the modal closed.
  quoteNo: string | null;
  companyNr: string | null;
  onClose: () => void;
}

export default function QuoteDetailModal({
  quoteNo,
  companyNr,
  onClose,
}: QuoteDetailModalProps) {
  const [quote, setQuote] = useState<FullQuote | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // No state reset needed here: the parent keys this component by quoteNo,
    // so switching quotes remounts it with fresh null state.
    if (!quoteNo || !companyNr) return;
    let active = true;

    fetch(
      `/api/quotes/quote?companyNr=${companyNr}&quoteNr=${encodeURIComponent(quoteNo)}`,
    )
      .then((r) => r.json())
      .then((result) => {
        if (!active) return;
        if (result.success && result.data?.quote) {
          setQuote(result.data.quote as FullQuote);
        } else {
          setError(result.message || "Quote not found.");
        }
      })
      .catch(() => {
        if (active) setError("Failed to load the quote.");
      });

    return () => {
      active = false;
    };
  }, [quoteNo, companyNr]);

  if (!quoteNo) return null;

  const address = quote
    ? [
        quote.deliveryAddress1,
        quote.deliveryAddress2,
        quote.deliveryAddress3,
        quote.deliveryAddress4,
        quote.deliveryAddress5,
      ]
        .map((a) => a?.trim())
        .filter((a) => a && a !== ".")
    : [];

  const expired =
    quote?.expiryDate != null && new Date(quote.expiryDate) < new Date();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#c6c6cd]/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0d9488]/10 border border-[#0d9488]/20 flex items-center justify-center text-[#0d9488] shrink-0">
              <FileText size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="font-display text-[16px] font-semibold text-[#0b1c30]">
                  Quote {quoteNo}
                </h2>
                {quote && (
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                      expired
                        ? "bg-[#e8eaf0] text-[#45464d] border-[#c6c6cd]"
                        : quote.status === 2
                          ? "bg-[#009668]/10 text-[#009668] border-[#009668]/20"
                          : quote.status === 3
                            ? "bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/25"
                            : quote.status === 1
                              ? "bg-[#F59E0B]/10 text-[#b45309] border-[#F59E0B]/30"
                              : "bg-[#eff4ff] text-[#006398] border-[#006398]/20"
                    }`}
                  >
                    {expired
                      ? "Expired"
                      : (QUOTE_STATUS_LABELS[quote.status] ?? quote.status)}
                  </span>
                )}
              </div>
              {quote && (
                <p className="text-[12px] text-[#76777d] mt-0.5">
                  {quote.accName.trim()} ·{" "}
                  <span className="font-mono">{quote.accNo.trim()}</span> ·{" "}
                  {fmtDate(quote.date)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#76777d] hover:text-[#0b1c30] transition p-1 rounded-md hover:bg-[#f0f2f8]"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {error ? (
            <p className="text-sm text-[#ba1a1a] py-8 text-center">{error}</p>
          ) : !quote ? (
            <p className="text-sm text-[#76777d] py-8 text-center">
              Loading quote…
            </p>
          ) : (
            <>
              {/* Details grid */}
              <div className="grid grid-cols-3 gap-x-6 gap-y-4 mb-5">
                <div>
                  <p className={labelCls}>Valid until</p>
                  <p className="text-[13.5px] text-[#0b1c30] mt-0.5">
                    {fmtDate(quote.expiryDate)}
                  </p>
                </div>
                <div>
                  <p className={labelCls}>Expected delivery</p>
                  <p className="text-[13.5px] text-[#0b1c30] mt-0.5">
                    {fmtDate(quote.expectedDate)}
                  </p>
                </div>
                <div>
                  <p className={labelCls}>Delivery method</p>
                  <p className="text-[13.5px] text-[#0b1c30] mt-0.5">
                    {DELIVERY_METHOD_LABELS[quote.deliveryMethod] ??
                      quote.deliveryMethod}
                  </p>
                </div>
                <div className={address.length > 0 ? "" : "hidden"}>
                  <p className={labelCls}>Deliver to</p>
                  <p className="text-[13.5px] text-[#0b1c30] mt-0.5">
                    {address.join(", ")}
                  </p>
                </div>
                {quote.repCode?.trim() && (
                  <div>
                    <p className={labelCls}>Sales rep</p>
                    <p className="text-[13.5px] text-[#0b1c30] mt-0.5">
                      {quote.repCode.trim()}
                    </p>
                  </div>
                )}
                {quote.notes?.trim() && (
                  <div className="col-span-3">
                    <p className={labelCls}>Message to client</p>
                    <p className="text-[13.5px] text-[#0b1c30] mt-0.5">
                      {quote.notes.trim()}
                    </p>
                  </div>
                )}
              </div>

              {/* Line items */}
              <div className="border border-[#c6c6cd]/60 rounded-lg overflow-hidden">
                <div className="grid grid-cols-[110px_1fr_60px_110px_70px_120px] gap-3 bg-[#f8f9ff] border-b border-[#c6c6cd]/60 px-4 py-2.5">
                  <p className={labelCls}>Code</p>
                  <p className={labelCls}>Description</p>
                  <p className={`${labelCls} text-right`}>Qty</p>
                  <p className={`${labelCls} text-right`}>Price</p>
                  <p className={`${labelCls} text-right`}>Disc</p>
                  <p className={`${labelCls} text-right`}>Line total</p>
                </div>
                {quote.body.length === 0 ? (
                  <p className="text-[13px] text-[#76777d] px-4 py-6 text-center">
                    No line items on this quote
                  </p>
                ) : (
                  quote.body.map((l) => (
                    <div
                      key={`${l.lineNo}-${l.stockcode}`}
                      className="grid grid-cols-[110px_1fr_60px_110px_70px_120px] gap-3 px-4 py-2.5 border-b border-[#c6c6cd]/40 last:border-0 items-center"
                    >
                      <p className="font-mono text-[12px] text-[#006398] truncate">
                        {l.stockcode.trim()}
                      </p>
                      <p className="text-[13px] text-[#0b1c30] truncate">
                        {l.description.trim()}
                      </p>
                      <p className="text-[13px] text-[#45464d] text-right tabular-nums">
                        {l.quantity}
                      </p>
                      <p className="text-[13px] text-[#45464d] text-right tabular-nums">
                        {fmtRand(l.price)}
                      </p>
                      <p className="text-[13px] text-[#45464d] text-right tabular-nums">
                        {l.discPercent > 0 ? `${l.discPercent}%` : "—"}
                      </p>
                      <p className="text-[13px] font-medium text-[#0b1c30] text-right tabular-nums">
                        {fmtRand(l.exclTotal)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Footer: totals + actions ── */}
        <div className="border-t border-[#c6c6cd]/60 px-6 py-4 shrink-0 flex items-end justify-between gap-6">
          <div className="flex gap-8">
            <div>
              <p className={labelCls}>Subtotal</p>
              <p className="text-[14px] font-semibold text-[#0b1c30] tabular-nums mt-0.5">
                {quote ? fmtRand(quote.goodsValue) : "—"}
              </p>
            </div>
            {quote != null && quote.discount > 0 && (
              <div>
                <p className={labelCls}>Discount</p>
                <p className="text-[14px] font-semibold text-[#ba1a1a] tabular-nums mt-0.5">
                  − {fmtRand(quote.discount)}
                </p>
              </div>
            )}
            {quote != null && quote.freight > 0 && (
              <div>
                <p className={labelCls}>Delivery</p>
                <p className="text-[14px] font-semibold text-[#0b1c30] tabular-nums mt-0.5">
                  {fmtRand(quote.freight)}
                </p>
              </div>
            )}
            <div>
              <p className={labelCls}>VAT</p>
              <p className="text-[14px] font-semibold text-[#0b1c30] tabular-nums mt-0.5">
                {quote ? fmtRand(quote.tax) : "—"}
              </p>
            </div>
            <div>
              <p className={labelCls}>Total</p>
              <p className="text-[20px] font-bold text-[#0b1c30] tabular-nums leading-tight">
                {quote ? fmtRand(quote.total) : "—"}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onClose}
              className="h-9 px-4 rounded-lg border border-[#c6c6cd] bg-white text-[#0b1c30] text-[13.5px] font-medium hover:bg-[#f8f9ff] transition-colors"
            >
              Close
            </button>
            {/* Amending is disabled until Revelation ships a salesquote
                update endpoint — its API can only CREATE sales quotes
                (proven live 2026-07-20), so any "amend" would really be a
                duplicate under a new number. */}
            <button
              disabled
              title="Amending quotes is coming soon — Revelation's API does not support updating a quote yet."
              className="h-9 px-4 rounded-lg bg-[#0d9488] text-white text-[13.5px] font-medium flex items-center gap-1.5 opacity-50 cursor-not-allowed"
            >
              <Pencil size={14} /> Amend Quote
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
