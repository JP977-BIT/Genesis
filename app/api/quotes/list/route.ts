// Lists all sales quotes for one account. Modelled on
// app/api/customertransactions/invoices/route.ts (auth + list-then-filter) —
// the upstream list endpoint has no accNo parameter, so we filter here.
// Deliberately uncached: quotes are created/revised by this app, and a stale
// list would hide a quote the user just saved.
import { NextResponse, NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getUserWithApiConnection } from "@/src/server/supabase/getUserWithApiConnection";
import { getRevelationToken } from "@/src/server/revelation/getRevelationToken";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();

  const { searchParams } = new URL(request.url);
  const companyNr = searchParams.get("companyNr");
  const accNo = searchParams.get("accNo");

  if (!companyNr || !accNo) {
    return NextResponse.json(
      { message: "companyNr and accNo are required" },
      { status: 400 },
    );
  }

  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    },
  );

  const userData = await getUserWithApiConnection(supabase, userId);
  if (!userData) {
    return NextResponse.json(
      { message: "No profile or API connection found" },
      { status: 404 },
    );
  }

  const { clientId, apiPin, apiConnection } = userData;

  const token = await getRevelationToken(clientId, apiConnection, apiPin);
  if (!token) {
    return NextResponse.json(
      { message: "Revelation API login failed" },
      { status: 401 },
    );
  }

  const upstream = await fetch(
    `${apiConnection.api_base_url}/api/quotes/quotes/headers`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      // 5000 matches the app-wide "fetch everything" convention; if a company
      // ever exceeds it the list truncates silently.
      body: JSON.stringify({ companyNr, startingRow: 0, numberOfRecords: 5000 }),
      signal: AbortSignal.timeout(30000),
    },
  );

  if (!upstream.ok) {
    return NextResponse.json({ message: "Upstream API error" }, { status: 502 });
  }

  // Revelation answers with a bodyless 204 (not an empty list) when there are
  // no quotes, and sends Content-Type: text/plain even when the body is JSON.
  const text = await upstream.text();
  if (upstream.status === 204 || text.trim() === "") {
    return NextResponse.json({ success: true, data: { salesQuotes: [] } });
  }

  let parsed: { data?: { salesQuotes?: Array<{ accNo?: string }> } };
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ message: "Upstream API error" }, { status: 502 });
  }

  // Upstream has no accNo filter — quote numbers are zero-padded and other
  // fields may be space-padded, so compare trimmed.
  const salesQuotes = (parsed.data?.salesQuotes ?? []).filter(
    (q) => q.accNo?.trim() === accNo,
  );

  return NextResponse.json({ success: true, data: { salesQuotes } });
}
