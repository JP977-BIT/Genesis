"use client";

import React, { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmCancelModalProps {
  open: boolean;
  /** What the user is abandoning — "quote", "sales order", "invoice"… */
  docName?: string;
  onKeepEditing: () => void;
  onDiscard: () => void;
}

/**
 * Shared "are you sure you want to cancel this document?" dialog for all
 * document-creation screens (quotes, sales orders, invoices, POs, GRNs).
 * Escape and clicking the backdrop both choose the safe option.
 */
export default function ConfirmCancelModal({
  open,
  docName = "document",
  onKeepEditing,
  onDiscard,
}: ConfirmCancelModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onKeepEditing();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onKeepEditing]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onKeepEditing();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-cancel-title"
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4"
      >
        <div className="px-6 pt-6 pb-4 flex items-start gap-4">
          <div className="w-11 h-11 rounded-full bg-[#ba1a1a]/10 border border-[#ba1a1a]/20 flex items-center justify-center text-[#ba1a1a] shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h2
              id="confirm-cancel-title"
              className="font-display text-[17px] font-semibold text-[#0b1c30]"
            >
              Cancel this {docName}?
            </h2>
            <p className="text-[14px] text-[#45464d] mt-1.5 leading-relaxed">
              Everything you&apos;ve entered on this {docName} will be lost.
              This cannot be undone.
            </p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[#c6c6cd]/60 flex justify-end gap-2.5">
          <button
            type="button"
            autoFocus
            onClick={onKeepEditing}
            className="h-11 px-5 rounded-lg border border-[#c6c6cd] bg-white text-[#0b1c30] text-[15px] font-medium hover:bg-[#f8f9ff] transition-colors focus-visible:outline-2 focus-visible:outline-[#0d9488]"
          >
            No, keep working
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="h-11 px-5 rounded-lg bg-[#ba1a1a] text-white text-[15px] font-semibold hover:bg-[#9a1515] transition-colors focus-visible:outline-2 focus-visible:outline-[#0d9488]"
          >
            Yes, cancel it
          </button>
        </div>
      </div>
    </div>
  );
}
