// Revelation writes its error messages for its own operators — e.g.
// "Customer was not Added. Please investigate Program Logs for more
// information" — which means nothing to an end user of this app. Translate
// the known-unhelpful ones into something actionable, and pass genuinely
// informative messages (e.g. validation errors) through unchanged.

type WriteAction = "create" | "update" | "delete";

function fallback(action: WriteAction, subject: string): string {
  switch (action) {
    case "create":
      return `The ${subject} could not be created. Please check the details and try again — if it keeps failing, contact your administrator.`;
    case "update":
      return "The changes could not be saved. Please try again — if it keeps failing, contact your administrator.";
    case "delete":
      return `The ${subject} could not be deleted. Please try again — if it keeps failing, contact your administrator.`;
  }
}

// Phrases that indicate a message aimed at Revelation operators, not users.
const UNHELPFUL = /program logs|investigate/i;

export function friendlyRevelationMessage(
  raw: string | undefined,
  action: WriteAction,
  subject = "client",
): string {
  if (!raw || UNHELPFUL.test(raw)) return fallback(action, subject);
  return raw;
}
