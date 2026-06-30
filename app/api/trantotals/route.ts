// Modelled on app/api/customers/ageanalysis/route.ts (auth + proxy pattern)
// and app/api/customers/route.ts (5-minute server-side cache).
import { NextResponse, NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getUserWithApiConnection } from "@/src/server/supabase/getUserWithApiConnection";
import { getRevelationToken } from "@/src/server/revelation/getRevelationToken";

// ── Server-side cache ─────────────────────────────────────────────────────────
// Keyed by `clientId:companyNr` so tenants never share cached data.
interface CachedTranTotals {
  data: unknown;
  expiresAt: number;
}
const tranTotalsCache = new Map<string, CachedTranTotals>();
const FIVE_MINUTES = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();

  const { searchParams } = new URL(request.url);
  const companyNr = searchParams.get("companyNr");

  if (!companyNr) {
    return NextResponse.json(
      { message: "companyNr is required" },
      { status: 400 },
    );
  }

  // x-user-id is stamped by middleware — no extra network call needed
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

  // Return cached result if still fresh — skips the Revelation round-trip
  const cacheKey = `${clientId}:${companyNr}`;
  const now = Date.now();
  const cached = tranTotalsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.data);
  }

  const token = await getRevelationToken(clientId, apiConnection, apiPin);
  if (!token) {
    return NextResponse.json(
      { message: "Revelation API login failed" },
      { status: 401 },
    );
  }

  const upstream = await fetch(
    `${apiConnection.api_base_url}/api/trantotals/trantotals`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        companyNr,
        startingRow: 0,
        // Large number to fetch all operator rows in one request,
        // matching the convention used in app/api/customers/route.ts.
        numberOfRecords: 5000,
        // accNo role on this endpoint is unconfirmed — empty string matches
        // what other routes send when accNo is not the primary filter.
        accNo: "",
      }),
      signal: AbortSignal.timeout(30000),
    },
  );

  if (!upstream.ok) {
    return NextResponse.json(
      { message: "Upstream API error" },
      { status: 502 },
    );
  }

  // Revelation returns Content-Type: text/plain even when the body is JSON.
  // Read as text first, then parse — prevents a JSON parse error on the header mismatch.
  const text = await upstream.text();
  let tranData: unknown;
  try {
    tranData = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { message: "Invalid response from upstream" },
      { status: 502 },
    );
  }

  const result = { success: true, data: tranData };
  tranTotalsCache.set(cacheKey, { data: result, expiresAt: now + FIVE_MINUTES });

  return NextResponse.json(result);
}
