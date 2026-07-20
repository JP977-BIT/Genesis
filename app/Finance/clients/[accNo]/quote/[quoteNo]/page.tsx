"use client";

// Amend (revise) an existing quote: loads the quote, then mounts the shared
// QuoteEditor prefilled with it. The static `new` segment wins over this
// dynamic one, so /quote/new never lands here.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import QuoteEditor, { type RevelationQuote } from "../components/QuoteEditor";

export default function AmendQuotePage() {
  const router = useRouter();
  const params = useParams();
  const accNo = params.accNo as string;
  const quoteNo = decodeURIComponent(params.quoteNo as string).trim();

  const [companyNr] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem("selectedCompany");
      if (stored)
        return (JSON.parse(stored) as { companyNr: string }).companyNr;
    } catch {}
    return null;
  });

  const [quote, setQuote] = useState<RevelationQuote | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!quoteNo || !companyNr) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/quotes/quote?companyNr=${companyNr}&quoteNr=${encodeURIComponent(quoteNo)}`,
        );
        const result = await res.json();
        if (!active) return;
        if (result.success && result.data?.quote) {
          setQuote(result.data.quote as RevelationQuote);
        } else {
          setError(result.message || "Quote not found.");
        }
      } catch {
        if (active) setError("Failed to load the quote.");
      }
    })();
    return () => {
      active = false;
    };
  }, [quoteNo, companyNr]);

  if (error) {
    return (
      <div className="flex h-screen bg-[#f8f9ff] font-body items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-[#ba1a1a]">{error}</p>
          <button
            onClick={() => router.push(`/Finance/clients/${accNo}`)}
            className="h-8 px-4 rounded border border-[#c6c6cd] bg-white text-[#0b1c30] text-sm font-medium flex items-center gap-1.5 hover:bg-[#f8f9ff] transition-colors"
          >
            <ArrowLeft size={14} /> Back to Client
          </button>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex h-screen bg-[#f8f9ff] font-body items-center justify-center">
        <p className="text-sm text-[#76777d]">Loading quote…</p>
      </div>
    );
  }

  return <QuoteEditor key={quoteNo} accNo={accNo} initialQuote={quote} />;
}
