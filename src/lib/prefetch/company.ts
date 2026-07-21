// Fired the moment the user picks a company (company-select) so the Finance
// module's data is loaded — or at least in flight — before they get there.
//
// Scope guard: prefetch ONLY the bounded per-company datasets below. Do NOT
// add per-account data (transactions, quotes, age analysis, customer detail)
// — those are unbounded (hundreds of accounts × several calls) and would
// flood the single Revelation upstream with data mostly never viewed; they
// lazy-load per section instead.
//
// Cold-start caveat, accepted: the three routes may race the server's
// Revelation token cache and trigger up to three logins — harmless, and the
// token is then warm for ~40 minutes.

import { prefetchCustomers } from "./customers";
import { prefetchStock } from "./stock";
import { prefetchTranTotals } from "@/src/lib/hooks/useTranTotals";

export function prefetchCompanyData(companyNr: string): void {
  prefetchCustomers(companyNr);
  prefetchStock(companyNr);
  prefetchTranTotals(companyNr);
}
