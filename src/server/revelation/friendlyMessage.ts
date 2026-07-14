// Revelation writes its error messages for its own operators — e.g.
// "Customer was not Added. Please investigate Program Logs for more
// information" — which means nothing to an end user of this app. Translate
// the known-unhelpful ones into something actionable, and pass genuinely
// informative messages (e.g. validation errors) through unchanged.

type CustomerAction = "create" | "update" | "delete";

const FALLBACK: Record<CustomerAction, string> = {
  create:
    "The client could not be created. Please check the details and try again — if it keeps failing, contact your administrator.",
  update:
    "The changes could not be saved. Please try again — if it keeps failing, contact your administrator.",
  delete:
    "The client could not be deleted. Please try again — if it keeps failing, contact your administrator.",
};

// Phrases that indicate a message aimed at Revelation operators, not users.
const UNHELPFUL = /program logs|investigate/i;

export function friendlyRevelationMessage(
  raw: string | undefined,
  action: CustomerAction,
): string {
  if (!raw || UNHELPFUL.test(raw)) return FALLBACK[action];
  return raw;
}
