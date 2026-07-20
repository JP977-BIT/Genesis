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

// ── Form state ────────────────────────────────────────────────────────────────
interface FormState {
  // Identity
  code: string;
  description: string;
  extendedDescription: string;
  barcode: string;
  // Pricing
  exclPrice: number;
  inclPrice: number;
  listPrice: number;
  stdCost: number;
  // Units & levels
  unitSale: string;
  unitPurch: string;
  unitWeight: number;
  unitVolume: number;
  minLevel: number;
  maxLevel: number;
  reOrderQty: number;
  // Flags
  allowSO: boolean;
  allowPO: boolean;
  posItem: boolean; // inverted into Revelation's nonPOSItem on submit
  serialItem: boolean;
  qtyDiscounts: boolean;
  // Other
  notes: string;
}

const EMPTY_FORM: FormState = {
  code: "",
  description: "",
  extendedDescription: "",
  barcode: "",
  exclPrice: 0,
  inclPrice: 0,
  listPrice: 0,
  stdCost: 0,
  unitSale: "",
  unitPurch: "",
  unitWeight: 0,
  unitVolume: 0,
  minLevel: 0,
  maxLevel: 0,
  reOrderQty: 0,
  allowSO: true,
  allowPO: true,
  posItem: true,
  serialItem: false,
  qtyDiscounts: false,
  notes: "",
};

// Revelation's add endpoint requires every nested object non-null even
// though reads return null for unset ones (confirmed live 2026-07-14) —
// empty shells with ""/0 values pass its validation. stockPic is the one
// exception: it's a System.Drawing.Bitmap that no JSON value satisfies (see
// docs/revelation-stock-add-bug-report.md), so null is the only sane value.
function emptyCat(): Record<string, unknown> {
  const accounts: Record<string, string> = {};
  for (let i = 1; i <= 30; i++) {
    const s = i === 1 ? "" : String(i);
    for (const p of [
      "salesAcc",
      "purchAcc",
      "cosAcc",
      "controlAcc",
      "clearingAcc",
    ]) {
      accounts[`${p}${s}`] = "";
    }
  }
  return {
    id: 0,
    code: "",
    name: "",
    markup: 0,
    cashDisc1: 0,
    cashDisc2: 0,
    cashDisc3: 0,
    ...accounts,
    bindDisplay: "",
  };
}

function emptyTaxCode(): Record<string, unknown> {
  return {
    code: "",
    name: "",
    taxType: "",
    taxRate: 0,
    taxOnSales: false,
    taxOnPurch: false,
    goodsOut: 0,
    vatOut: 0,
    goodsAdjustOut: 0,
    vatAdjustOut: 0,
    goodsIn: 0,
    vatIn: 0,
    goodsAdjustIn: 0,
    vatAdjustIn: 0,
  };
}

function emptyUD(): Record<string, unknown> {
  return { dbId: 0, code: "", fieldName: "", data: "" };
}

function emptyNominalContra(today: string): Record<string, unknown> {
  const budgets: Record<string, unknown> = {};
  for (let i = 1; i <= 24; i++) {
    const s = String(i).padStart(2, "0");
    budgets[`budget${s}`] = 0;
    budgets[`dueDate${s}`] = today;
  }
  return {
    accNo: "",
    quickRef: "",
    accName: "",
    department: "",
    group: "",
    balance: 0,
    ...budgets,
    taxCode: emptyTaxCode(),
  };
}

// Builds the full Revelation stockItem object from the form, filling every
// scalar field with a safe default so the API never receives undefined.
function buildStockItem(f: FormState): Record<string, unknown> {
  const today = new Date().toISOString();
  return {
    dbId: 0,
    code: f.code,
    itemType: 0,
    description: f.description,
    extendedDescription: f.extendedDescription,
    coP_Description: "",
    cat: emptyCat(),
    exclPrice: f.exclPrice,
    inclPrice: f.inclPrice,
    avgCostPrice: 0,
    latestCostPrice: 0,
    listPrice: f.listPrice,
    stdCost: f.stdCost,
    discType1: 0,
    discType2: 0,
    discType3: 0,
    discType4: 0,
    discType5: 0,
    discType6: 0,
    from1: 0,
    to1: 0,
    qtyDisc1: 0,
    from2: 0,
    to2: 0,
    qtyDisc2: 0,
    qtyDisc3: 0,
    qtyDiscounts: f.qtyDiscounts,
    promoPrcExcl: 0,
    promoPrcIncl: 0,
    saleStart: today,
    saleEnd: today,
    onPromation: false,
    matrixPrices: [],
    taxCode: emptyTaxCode(),
    onHand: 0,
    available: 0,
    isMessageLine: false,
    serialItem: f.serialItem,
    allowPO: f.allowPO,
    allowSO: f.allowSO,
    promptLineDisc: false,
    noteDescription: false,
    nominalAnalysis: false,
    alwaysPromptQtyPOS: false,
    promptDescription: false,
    ignoreOnhandOnline: false,
    noAllowOnlineSales: false,
    noGrn: false,
    frozen: false,
    nonPOSItem: !f.posItem,
    notes: f.notes,
    picLocation: "",
    stockPic: null,
    itemPicture: "",
    hasPic: false,
    barcode: f.barcode,
    supercede: "",
    crossIndex: "",
    unitSale: f.unitSale,
    unitPurch: f.unitPurch,
    unitWeight: f.unitWeight,
    unitVolume: f.unitVolume,
    salesOrders: 0,
    purchaseOrders: 0,
    workInProg: 0,
    inProductionWMan: 0,
    inProductionBOM: 0,
    supplier1Code: "",
    supplier1AccNo: "",
    supplier1Name: "",
    supplier1ListPrice: 0,
    supplier1LeadTime: 0,
    supplier2Code: "",
    supplier2AccNo: "",
    supplier2Name: "",
    supplier2ListPrice: 0,
    supplier2LeadTime: 0,
    supplier3Code: "",
    supplier3AccNo: "",
    supplier3Name: "",
    supplier3ListPrice: 0,
    supplier3LeadTime: 0,
    supplier4Code: "",
    supplier4AccNo: "",
    supplier4Name: "",
    supplier4ListPrice: 0,
    supplier4LeadTime: 0,
    supplier5Code: "",
    supplier5AccNo: "",
    supplier5Name: "",
    supplier5ListPrice: 0,
    supplier5LeadTime: 0,
    qtyDecml: "0",
    prcDecml: "2",
    guaranteePeriod: "",
    bin: { dbId: 0, code: "", description: "", bindDisplay: "" },
    uD1: emptyUD(),
    uD2: emptyUD(),
    uD3: emptyUD(),
    uD4: emptyUD(),
    uD5: emptyUD(),
    uD6: emptyUD(),
    nominalContra: emptyNominalContra(today),
    minLevel: f.minLevel,
    maxLevel: f.maxLevel,
    reOrderQty: f.reOrderQty,
    salesMTD: 0,
    salesCPMTD: 0,
    salesSPMTD: 0,
    salesPrfMTD: 0,
    issueMTD: 0,
    issueCPMTD: 0,
    issueSPMTD: 0,
    issuePrfMTD: 0,
    salesYTD: 0,
    salesCPYTD: 0,
    salesSPYTD: 0,
    salesPrfYTD: 0,
    issueYTD: 0,
    issueCPYTD: 0,
    issueSPYTD: 0,
    issuePrfYTD: 0,
    lastPrchDate: today,
    lastPrchQty: 0,
    lastSaleDate: today,
    lastSaleQty: 0,
    lastIssueDate: today,
    lastIssueQty: 0,
    brFrwd: 0,
    issuedBOM: 0,
    issuedWM: 0,
    branchTrf: 0,
    adjustDate: today,
    adjustTimes: 0,
    adjustQtyMTD: 0,
    adjustQtyYTD: 0,
    maxLineDisc: 0,
    markupOn: "",
    itemCd: "",
    itemClsCd: "",
    itemTyCd: "",
    orgnNatCd: "",
    pkgUnitCd: "",
    qtyUnitCd: "",
    vatCatCd: "",
    iplCatCd: "",
    tlCatCd: "",
    exciseTxCatCd: "",
    isrcAplcbYn: "",
  };
}

// Revelation's stock code limit hasn't been probed empirically the way the
// 7-char account number limit was — 15 is the conventional Revelation cap.
export const MAX_STOCK_CODE_LENGTH = 15;

// Derives a unique stock code from the description: up to 4 alphanumeric
// characters (uppercased) as a prefix, plus the lowest zero-padded counter
// that isn't already taken.
function generateCode(description: string, existingCodes: string[]): string {
  const prefix =
    description
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4) || "ITEM";
  const taken = new Set(existingCodes.map((c) => c.trim().toUpperCase()));

  const candidateFor = (n: number) => {
    const digits = String(n).padStart(3, "0");
    return `${prefix}${digits}`;
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
interface CreateStockModalProps {
  isOpen: boolean;
  companyNr: string | null;
  existingCodes: string[];
  onClose: () => void;
  onCreated: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CreateStockModal({
  isOpen,
  companyNr,
  existingCodes,
  onClose,
  onCreated,
}: CreateStockModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Once the user hand-edits the code we stop auto-generating it, so their
  // choice is never overwritten as they keep typing the description.
  const [codeEdited, setCodeEdited] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY_FORM);
      setError(null);
      setCodeEdited(false);
    }
  }, [isOpen]);

  // Auto-fill the code from the description until the user overrides it.
  const onDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const description = e.target.value;
    setForm((p) => ({
      ...p,
      description,
      code: codeEdited ? p.code : generateCode(description, existingCodes),
    }));
  };

  const onCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCodeEdited(true);
    setForm((p) => ({ ...p, code: e.target.value }));
  };

  const str =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const num =
    (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: parseFloat(e.target.value) || 0 }));

  const chk = (field: keyof FormState) => (v: boolean) =>
    setForm((p) => ({ ...p, [field]: v }));

  const handleSubmit = async () => {
    if (!form.code.trim()) {
      setError("Stock code is required");
      return;
    }
    if (form.code.trim().length > MAX_STOCK_CODE_LENGTH) {
      setError(
        `Stock code must be ${MAX_STOCK_CODE_LENGTH} characters or fewer`,
      );
      return;
    }
    if (!form.description.trim()) {
      setError("Description is required");
      return;
    }
    if (!companyNr) {
      setError("No company selected");
      return;
    }

    const taken = new Set(existingCodes.map((c) => c.trim().toUpperCase()));
    if (taken.has(form.code.trim().toUpperCase())) {
      setError(`Stock code "${form.code.trim()}" already exists`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/stock/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyNr, stockItem: buildStockItem(form) }),
      });
      const result = await res.json();
      if (result.success) {
        onCreated();
        onClose();
      } else {
        setError(result.message ?? "Failed to create stock item");
      }
    } catch {
      setError("Network error — could not create stock item");
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
              New Stock Item
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
            <Field label="Description" required>
              <input
                className={inputCls}
                value={form.description}
                onChange={onDescriptionChange}
                placeholder="Item description"
                autoFocus
              />
            </Field>
            <Field label="Stock Code" required>
              <input
                className={inputCls}
                value={form.code}
                onChange={onCodeChange}
                placeholder="Auto-generated from description"
                maxLength={MAX_STOCK_CODE_LENGTH}
              />
              <p className="text-[11px] text-[#76777d] mt-1">
                {codeEdited
                  ? `Custom code — max ${MAX_STOCK_CODE_LENGTH} characters`
                  : "Auto-generated & unique — edit to override"}
              </p>
            </Field>
            <Field label="Extended Description">
              <input
                className={inputCls}
                value={form.extendedDescription}
                onChange={str("extendedDescription")}
                placeholder="Additional description"
              />
            </Field>
            <Field label="Barcode">
              <input
                className={inputCls}
                value={form.barcode}
                onChange={str("barcode")}
                placeholder="EAN / UPC"
              />
            </Field>
          </div>

          {/* Pricing */}
          <SectionHeader title="Pricing" />
          <div className="grid grid-cols-4 gap-x-4 gap-y-3">
            <Field label="Excl Price">
              <input
                className={inputCls}
                type="number"
                value={form.exclPrice}
                onChange={num("exclPrice")}
                min={0}
                step={0.01}
              />
            </Field>
            <Field label="Incl Price">
              <input
                className={inputCls}
                type="number"
                value={form.inclPrice}
                onChange={num("inclPrice")}
                min={0}
                step={0.01}
              />
            </Field>
            <Field label="List Price">
              <input
                className={inputCls}
                type="number"
                value={form.listPrice}
                onChange={num("listPrice")}
                min={0}
                step={0.01}
              />
            </Field>
            <Field label="Standard Cost">
              <input
                className={inputCls}
                type="number"
                value={form.stdCost}
                onChange={num("stdCost")}
                min={0}
                step={0.01}
              />
            </Field>
          </div>

          {/* Units & levels */}
          <SectionHeader title="Units &amp; Stock Levels" />
          <div className="grid grid-cols-3 gap-x-4 gap-y-3">
            <Field label="Unit of Sale">
              <input
                className={inputCls}
                value={form.unitSale}
                onChange={str("unitSale")}
                placeholder="EACH / BOX / KG"
              />
            </Field>
            <Field label="Unit of Purchase">
              <input
                className={inputCls}
                value={form.unitPurch}
                onChange={str("unitPurch")}
                placeholder="EACH / BOX / KG"
              />
            </Field>
            <Field label="Unit Weight">
              <input
                className={inputCls}
                type="number"
                value={form.unitWeight}
                onChange={num("unitWeight")}
                min={0}
                step={0.001}
              />
            </Field>
            <Field label="Minimum Level">
              <input
                className={inputCls}
                type="number"
                value={form.minLevel}
                onChange={num("minLevel")}
                min={0}
              />
            </Field>
            <Field label="Maximum Level">
              <input
                className={inputCls}
                type="number"
                value={form.maxLevel}
                onChange={num("maxLevel")}
                min={0}
              />
            </Field>
            <Field label="Re-order Quantity">
              <input
                className={inputCls}
                type="number"
                value={form.reOrderQty}
                onChange={num("reOrderQty")}
                min={0}
              />
            </Field>
          </div>

          {/* Preferences */}
          <SectionHeader title="Preferences" />
          <div className="grid grid-cols-4 gap-x-4 gap-y-3">
            <Check
              label="Allow Sales Orders"
              checked={form.allowSO}
              onChange={chk("allowSO")}
            />
            <Check
              label="Allow Purchase Orders"
              checked={form.allowPO}
              onChange={chk("allowPO")}
            />
            <Check
              label="POS Item"
              checked={form.posItem}
              onChange={chk("posItem")}
            />
            <Check
              label="Serial Item"
              checked={form.serialItem}
              onChange={chk("serialItem")}
            />
            <Check
              label="Quantity Discounts"
              checked={form.qtyDiscounts}
              onChange={chk("qtyDiscounts")}
            />
          </div>

          {/* Notes */}
          <SectionHeader title="Other" />
          <Field label="Notes">
            <textarea
              className={`${inputCls} resize-none`}
              rows={3}
              value={form.notes}
              onChange={str("notes")}
              placeholder="Internal notes about this item…"
            />
          </Field>
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
              {saving ? "Creating…" : "Create Item"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
