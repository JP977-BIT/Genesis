// Client-side cache for the per-company customers list.
// Fire prefetchCustomers early (on company-select); consumers call
// getCustomers, which reuses the in-flight or fresh (<5 min) result and only
// refetches when stale or forced.

import { createClientCache } from "./prefetch";

const customersCache = createClientCache<unknown[]>((companyNr) =>
  fetch(`/api/customers?companyNr=${companyNr}&numberOfRecords=5000`)
    .then((r) => r.json())
    .then((result) => (result.success ? result.data.customers : null)),
);

export const prefetchCustomers = customersCache.prefetch;
export const getCustomers = customersCache.get;
