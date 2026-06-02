// Module-level store — survives client-side page navigations (same bundle).
// Fire prefetchCustomers early (e.g. on company-select); Finance page consumes it.

interface Prefetch {
  companyNr: string;
  promise: Promise<unknown[] | null>;
}

let pending: Prefetch | null = null;

export function prefetchCustomers(companyNr: string): void {
  if (pending?.companyNr === companyNr) return; // already running
  pending = {
    companyNr,
    promise: fetch(
      `/api/customers?companyNr=${companyNr}&numberOfRecords=5000`,
    )
      .then((r) => r.json())
      .then((result) => (result.success ? result.data.customers : null))
      .catch(() => null),
  };
}

// Returns the in-flight (or completed) promise if it matches companyNr, then clears it.
export function consumeCustomerPrefetch(
  companyNr: string,
): Promise<unknown[] | null> | null {
  if (pending?.companyNr === companyNr) {
    const p = pending.promise;
    pending = null;
    return p;
  }
  return null;
}
