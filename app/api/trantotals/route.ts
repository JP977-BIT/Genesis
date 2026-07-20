// Modelled on app/api/customers/ageanalysis/route.ts (auth + proxy pattern)
// and app/api/customers/route.ts (5-minute server-side cache).
import { NextResponse, NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { getUserWithApiConnection } from "@/src/server/supabase/getUserWithApiConnection";
import { getRevelationToken } from "@/src/server/revelation/getRevelationToken";

const FIVE_MINUTES_S = 5 * 60;

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

  const token = await getRevelationToken(clientId, apiConnection, apiPin);
  if (!token) {
    return NextResponse.json(
      { message: "Revelation API login failed" },
      { status: 401 },
    );
  }

  // Cached in the Next.js data cache — persists across serverless instances,
  // keyed by (client, company) so tenants never share cached data. The token
  // stays in the closure so token rotation doesn't bust the cache.
  try {
    const result = await unstable_cache(
      async () => {
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
          // Thrown errors are not cached — a failure must not be served as a
          // result for the next 5 minutes.
          throw new Error(`Upstream API error ${upstream.status}`);
        }

        // Revelation returns Content-Type: text/plain even when the body is JSON.
        // Read as text first, then parse — prevents a JSON parse error on the header mismatch.
        const text = await upstream.text();

        // Revelation answers with a bodyless 204 (not an empty list) when the
        // company has no till-operator rows — treat it as an empty result.
        if (upstream.status === 204 || text.trim() === "") {
          return { success: true, data: { data: { tranTotals: [], totalRows: 0 } } };
        }

        const tranData: unknown = JSON.parse(text);

        return { success: true, data: tranData };
      },
      ["trantotals", clientId, companyNr],
      {
        revalidate: FIVE_MINUTES_S,
        tags: [`trantotals-${clientId}-${companyNr}`],
      },
    )();

    return NextResponse.json(result);
  } catch (err) {
    console.error("trantotals upstream failure:", err);
    return NextResponse.json(
      { message: "Upstream API error" },
      { status: 502 },
    );
  }
}
