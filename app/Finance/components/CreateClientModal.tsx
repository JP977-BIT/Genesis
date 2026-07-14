"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";

// ── Design tokens ─────────────────────────────────────────────────────────────
const inputCls =
  "w-full px-3 py-1.5 text-sm border border-[#c6c6cd] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0d9488]/20 focus:border-[#0d9488] transition font-body bg-white";

const labelCls =
  "block text-[11px] font-semibold uppercase tracking-[0.05em] text-[#45464d] mb-1";

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-3 mt-6 first:mt-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#45464d] shrink-0">
        {title}
      </p>
      <div className="flex-1 h-px bg-[#c6c6cd]/60" />
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>
        {label}
        {required && <span className="text-[#ba1a1a] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3.5 h-3.5 rounded border-[#c6c6cd] accent-[#0d9488] cursor-pointer"
      />
      <span className="text-[12px] text-[#45464d]">{label}</span>
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
}: {
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string | number; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      className={`${inputCls} cursor-pointer`}
      value={value}
      onChange={onChange}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const ACCOUNT_TYPE_OPTIONS = [
  { value: 0, label: "Open item" },
  { value: 1, label: "Balance forward account" },
];

// ── Form state ────────────────────────────────────────────────────────────────
interface FormState {
  // Identity
  accNo: string;
  name: string;
  title: string;
  initials: string;
  // Contact
  contact: string;
  phone: string;
  cellPhone: string;
  fax: string;
  eMail: string;
  // Address
  address1: string;
  address2: string;
  address3: string;
  address4: string;
  // Account
  accType: number;
  category: string;
  terms: string;
  repCode: string;
  areaCode: string;
  branchCode: string;
  stockPrc: string;
  creditLimit: number;
  tradeDisc: number;
  settleDisc: number;
  currency: number;
  // Banking
  bank: string;
  bankCode: string;
  bankAccNo: string;
  // Flags
  activeYN: boolean;
  stmtsYN: boolean;
  payVatYN: boolean;
  noHoldYN: boolean;
  odIntYN: boolean;
  ordersYN: boolean;
  labelsYN: boolean;
  exclInclYN: boolean;
  // Other
  notes: string;
  gstNumber: string;
  vendorNo: string;
}

const EMPTY_FORM: FormState = {
  accNo: "",
  name: "",
  title: "",
  initials: "",
  contact: "",
  phone: "",
  cellPhone: "",
  fax: "",
  eMail: "",
  address1: "",
  address2: "",
  address3: "",
  address4: "",
  accType: 0,
  category: "",
  terms: "",
  repCode: "",
  areaCode: "",
  branchCode: "",
  stockPrc: "",
  creditLimit: 0,
  tradeDisc: 0,
  settleDisc: 0,
  currency: 0,
  bank: "",
  bankCode: "",
  bankAccNo: "",
  activeYN: true,
  stmtsYN: false,
  payVatYN: true,
  noHoldYN: false,
  odIntYN: false,
  ordersYN: true,
  labelsYN: false,
  exclInclYN: false,
  notes: "",
  gstNumber: "",
  vendorNo: "",
};

// Builds the full Revelation customer object from the form, filling every
// required field with a safe default so the API never receives undefined.
function buildCustomer(f: FormState): Record<string, unknown> {
  const today = new Date().toISOString();
  return {
    ...f,
    // System-computed fields default to 0 / false / ""
    days180: 0,
    days150: 0,
    days120: 0,
    days90: 0,
    days60: 0,
    days30: 0,
    current: 0,
    balance: 0,
    bFrwd: 0,
    newCurrent: 0,
    oiCounter: 0,
    instal6: 0,
    instal5: 0,
    instal4: 0,
    instal3: 0,
    instal2: 0,
    instal1: 0,
    instal0: 0,
    days180Last: 0,
    days150Last: 0,
    days120Last: 0,
    days90Last: 0,
    days60Last: 0,
    days30Last: 0,
    currentLast: 0,
    balanceLast: 0,
    mtdcp: 0,
    mtdsp: 0,
    mtdProfit: 0,
    ytdcp: 0,
    ytdsp: 0,
    ytdProfit: 0,
    mtdManual: 0,
    ytdManual: 0,
    lastInvAmt: 0,
    lastRecAmt: 0,
    sendInvoiceBy: 0,
    deliveryMethod: 0,
    industry: 0,
    flagYN9: false,
    flagYN10: false,
    loyaltyYN: false,
    loyaltyCardNo: "",
    optOrdMail: false,
    optFaxMail: false,
    optEMail: false,
    custom1: "",
    custom2: "",
    custom3: "",
    custom4: "",
    custom5: "",
    custom6: "",
    agedInv: "",
    keepTrans: "",
    intPeriod: "",
    programVersion: "",
    vendorNo: f.vendorNo,
    dateOpen: today,
    lastInvDt: today,
    lastRecDt: today,
  };
}

// Revelation rejects account numbers longer than 7 characters (its internal
// error 807), so generated numbers must never exceed it.
export const MAX_ACC_NO_LENGTH = 7;

// Derives a unique account number from the client's name: up to 4
// alphanumeric characters of the name (uppercased) as a prefix, plus the
// lowest zero-padded counter that isn't already taken — guaranteeing no two
// clients share an account number and never exceeding 7 characters (the
// prefix shrinks if the counter ever needs more digits).
function generateAccNo(name: string, existingAccNos: string[]): string {
  const prefix =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4) || "CUST";
  const taken = new Set(existingAccNos.map((a) => a.trim().toUpperCase()));

  const candidateFor = (n: number) => {
    const digits = String(n).padStart(3, "0");
    return `${prefix.slice(0, MAX_ACC_NO_LENGTH - digits.length)}${digits}`;
  };

  let n = 1;
  let candidate = candidateFor(n);
  while (taken.has(candidate)) {
    n += 1;
    candidate = candidateFor(n);
  }
  return candidate;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface CreateClientModalProps {
  isOpen: boolean;
  companyNr: string | null;
  existingAccNos: string[];
  onClose: () => void;
  onCreated: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CreateClientModal({
  isOpen,
  companyNr,
  existingAccNos,
  onClose,
  onCreated,
}: CreateClientModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Once the user hand-edits the account number we stop auto-generating it,
  // so their choice is never overwritten as they keep typing the name.
  const [accNoEdited, setAccNoEdited] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY_FORM);
      setError(null);
      setAccNoEdited(false);
    }
  }, [isOpen]);

  // Auto-fill the account number from the name until the user overrides it.
  const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setForm((p) => ({
      ...p,
      name,
      accNo: accNoEdited ? p.accNo : generateAccNo(name, existingAccNos),
    }));
  };

  const onAccNoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAccNoEdited(true);
    setForm((p) => ({ ...p, accNo: e.target.value }));
  };

  const str =
    (field: keyof FormState) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const num =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [field]: parseFloat(e.target.value) || 0 }));

  const chk = (field: keyof FormState) => (v: boolean) =>
    setForm((p) => ({ ...p, [field]: v }));

  const handleSubmit = async () => {
    if (!form.accNo.trim()) {
      setError("Account number is required");
      return;
    }
    if (form.accNo.trim().length > MAX_ACC_NO_LENGTH) {
      setError(
        `Account number must be ${MAX_ACC_NO_LENGTH} characters or fewer`,
      );
      return;
    }
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!companyNr) {
      setError("No company selected");
      return;
    }

    const taken = new Set(existingAccNos.map((a) => a.trim().toUpperCase()));
    if (taken.has(form.accNo.trim().toUpperCase())) {
      setError(`Account number "${form.accNo.trim()}" already exists`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/customers/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyNr, customer: buildCustomer(form) }),
      });
      const result = await res.json();
      if (result.success) {
        onCreated();
        onClose();
      } else {
        setError(result.message ?? "Failed to create client");
      }
    } catch {
      setError("Network error — could not create client");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#c6c6cd]/60 shrink-0">
          <div>
            <h2 className="font-display text-[16px] font-semibold text-[#0b1c30]">
              New Client
            </h2>
            <p className="text-[12px] text-[#76777d] mt-0.5">
              Fields marked <span className="text-[#ba1a1a]">*</span> are
              required
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#76777d] hover:text-[#0b1c30] transition p-1 rounded-md hover:bg-[#f0f2f8]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {/* Identity */}
          <SectionHeader title="Identity" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Name" required>
              <input
                className={inputCls}
                value={form.name}
                onChange={onNameChange}
                placeholder="Company or person name"
                autoFocus
              />
            </Field>
            <Field label="Account No" required>
              <input
                className={inputCls}
                value={form.accNo}
                onChange={onAccNoChange}
                placeholder="Auto-generated from name"
                maxLength={MAX_ACC_NO_LENGTH}
              />
              <p className="text-[11px] text-[#76777d] mt-1">
                {accNoEdited
                  ? `Custom account number — max ${MAX_ACC_NO_LENGTH} characters`
                  : "Auto-generated & unique — edit to override"}
              </p>
            </Field>
            <Field label="Title">
              <input
                className={inputCls}
                value={form.title}
                onChange={str("title")}
                placeholder="Mr / Ms / Dr"
              />
            </Field>
            <Field label="Initials">
              <input
                className={inputCls}
                value={form.initials}
                onChange={str("initials")}
                placeholder="D.D"
              />
            </Field>
          </div>

          {/* Contact */}
          <SectionHeader title="Contact" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Contact Person">
              <input
                className={inputCls}
                value={form.contact}
                onChange={str("contact")}
                placeholder="Full name"
              />
            </Field>
            <Field label="Email">
              <input
                className={inputCls}
                type="email"
                value={form.eMail}
                onChange={str("eMail")}
                placeholder="email@example.com"
              />
            </Field>
            <Field label="Phone">
              <input
                className={inputCls}
                value={form.phone}
                onChange={str("phone")}
                placeholder="+27 11 000 0000"
              />
            </Field>
            <Field label="Cell Phone">
              <input
                className={inputCls}
                value={form.cellPhone}
                onChange={str("cellPhone")}
                placeholder="+27 82 000 0000"
              />
            </Field>
            <Field label="Fax">
              <input
                className={inputCls}
                value={form.fax}
                onChange={str("fax")}
                placeholder="+27 11 000 0001"
              />
            </Field>
          </div>

          {/* Address */}
          <SectionHeader title="Address" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Address Line 1">
              <input
                className={inputCls}
                value={form.address1}
                onChange={str("address1")}
                placeholder="Street / PO Box"
              />
            </Field>
            <Field label="Address Line 2">
              <input
                className={inputCls}
                value={form.address2}
                onChange={str("address2")}
                placeholder="Suburb"
              />
            </Field>
            <Field label="Address Line 3">
              <input
                className={inputCls}
                value={form.address3}
                onChange={str("address3")}
                placeholder="City"
              />
            </Field>
            <Field label="Address Line 4">
              <input
                className={inputCls}
                value={form.address4}
                onChange={str("address4")}
                placeholder="Postal code"
              />
            </Field>
          </div>

          {/* Account Settings */}
          <SectionHeader title="Account Settings" />
          <div className="grid grid-cols-3 gap-x-4 gap-y-3">
            <Field label="Account Type">
              <Select
                value={form.accType}
                onChange={num("accType")}
                options={ACCOUNT_TYPE_OPTIONS}
                placeholder="Select account type"
              />
            </Field>
            <Field label="Category">
              <Select
                value={form.category}
                onChange={str("category")}
                options={[]}
                placeholder="Select category"
              />
            </Field>
            <Field label="Terms">
              <Select
                value={form.terms}
                onChange={str("terms")}
                options={[]}
                placeholder="Select terms"
              />
            </Field>
            <Field label="Rep Code">
              <Select
                value={form.repCode}
                onChange={str("repCode")}
                options={[]}
                placeholder="Select sales rep"
              />
            </Field>
            <Field label="Area Code">
              <Select
                value={form.areaCode}
                onChange={str("areaCode")}
                options={[]}
                placeholder="Select area"
              />
            </Field>
            <Field label="Branch Code">
              <Select
                value={form.branchCode}
                onChange={str("branchCode")}
                options={[]}
                placeholder="Select branch"
              />
            </Field>
            <Field label="Stock Price Code">
              <Select
                value={form.stockPrc}
                onChange={str("stockPrc")}
                options={[]}
                placeholder="Select price level"
              />
            </Field>
            <Field label="Currency">
              <Select
                value={form.currency}
                onChange={num("currency")}
                options={[]}
                placeholder="Select currency"
              />
            </Field>
          </div>

          {/* Financial */}
          <SectionHeader title="Financial" />
          <div className="grid grid-cols-3 gap-x-4 gap-y-3">
            <Field label="Credit Limit (R)">
              <input
                className={inputCls}
                type="number"
                value={form.creditLimit}
                onChange={num("creditLimit")}
                min={0}
                step={0.01}
              />
            </Field>
            <Field label="Trade Disc (%)">
              <input
                className={inputCls}
                type="number"
                value={form.tradeDisc}
                onChange={num("tradeDisc")}
                min={0}
                max={100}
                step={0.01}
              />
            </Field>
            <Field label="Settle Disc (%)">
              <input
                className={inputCls}
                type="number"
                value={form.settleDisc}
                onChange={num("settleDisc")}
                min={0}
                max={100}
                step={0.01}
              />
            </Field>
          </div>

          {/* Banking */}
          <SectionHeader title="Banking" />
          <div className="grid grid-cols-3 gap-x-4 gap-y-3">
            <Field label="Bank">
              <input
                className={inputCls}
                value={form.bank}
                onChange={str("bank")}
                placeholder="Bank name"
              />
            </Field>
            <Field label="Branch Code">
              <input
                className={inputCls}
                value={form.bankCode}
                onChange={str("bankCode")}
                placeholder="Branch code"
              />
            </Field>
            <Field label="Account No">
              <input
                className={inputCls}
                value={form.bankAccNo}
                onChange={str("bankAccNo")}
                placeholder="Bank account number"
              />
            </Field>
          </div>

          {/* Preferences */}
          <SectionHeader title="Preferences" />
          <div className="grid grid-cols-4 gap-x-4 gap-y-3">
            <Check
              label="Active"
              checked={form.activeYN}
              onChange={chk("activeYN")}
            />
            <Check
              label="Pay VAT"
              checked={form.payVatYN}
              onChange={chk("payVatYN")}
            />
            <Check
              label="Statements"
              checked={form.stmtsYN}
              onChange={chk("stmtsYN")}
            />
            <Check
              label="No Hold"
              checked={form.noHoldYN}
              onChange={chk("noHoldYN")}
            />
            <Check
              label="OD Interest"
              checked={form.odIntYN}
              onChange={chk("odIntYN")}
            />
            <Check
              label="Orders"
              checked={form.ordersYN}
              onChange={chk("ordersYN")}
            />
            <Check
              label="Labels"
              checked={form.labelsYN}
              onChange={chk("labelsYN")}
            />
            <Check
              label="Excl/Incl"
              checked={form.exclInclYN}
              onChange={chk("exclInclYN")}
            />
          </div>

          {/* Notes */}
          <SectionHeader title="Other" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="GST / VAT Number">
              <input
                className={inputCls}
                value={form.gstNumber}
                onChange={str("gstNumber")}
                placeholder="Tax registration number"
              />
            </Field>
            <Field label="Vendor No">
              <input
                className={inputCls}
                value={form.vendorNo}
                onChange={str("vendorNo")}
                placeholder="Vendor reference"
              />
            </Field>
            <div className="col-span-2">
              <Field label="Notes">
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={3}
                  value={form.notes}
                  onChange={str("notes")}
                  placeholder="Internal notes about this client…"
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#c6c6cd]/60 shrink-0 flex items-center justify-between gap-4">
          {error ? (
            <p className="text-[12px] text-[#ba1a1a] flex-1">{error}</p>
          ) : (
            <div className="flex-1" />
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="h-8 px-4 rounded-md border border-[#c6c6cd] text-[13px] font-medium text-[#45464d] hover:bg-[#f0f2f8] transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="h-8 px-5 rounded-md bg-[#0d9488] text-white text-[13px] font-medium hover:bg-[#0b7c72] transition flex items-center gap-2 disabled:opacity-60"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving ? "Creating…" : "Create Client"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
