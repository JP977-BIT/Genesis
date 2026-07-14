// Revelation's read endpoints return `loyaltyCardNo: null` on customers that
// have no loyalty card, but its write endpoints (add/update/delete) reject
// null there with a model-validation 400 ("The LoyaltyCardNo field is
// required"). Coerce it before writing a customer back so round-tripping a
// fetched record always works.
export function sanitizeCustomer(customer: unknown): unknown {
  if (typeof customer !== "object" || customer === null) return customer;
  const c = customer as Record<string, unknown>;
  return { ...c, loyaltyCardNo: c.loyaltyCardNo ?? "" };
}
