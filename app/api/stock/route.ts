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
  const startingRow = parseInt(searchParams.get("startingRow") ?? "0", 10);
  const numberOfRecords = parseInt(
    searchParams.get("numberOfRecords") ?? "50",
    10,
  );
  const includeDormantItems =
    searchParams.get("includeDormantItems") !== "false";
  const warehouseNr = parseInt(searchParams.get("warehouseNr") ?? "0", 10);

  if (!companyNr) {
    return NextResponse.json(
      { message: "companyNr is required" },
      { status: 400 },
    );
  }

  // Read the user ID stamped by middleware — no network call needed
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Still need the client for the database query below
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

  // One round trip instead of two — profile + api connection together
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

  // Cached in the Next.js data cache — same rationale as /api/customers:
  // the slow Revelation call is paid once per 5 minutes per (client,
  // company, page), and the token stays out of the cache key.
  try {
    const stockData = await unstable_cache(
      async () => {
        const stockResponse = await fetch(
          `${apiConnection.api_base_url}/api/stock/stockitems`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              companyNr: companyNr,
              includeDormantItems: includeDormantItems,
              startingRow: startingRow,
              // Revelation's field really is spelled "numberOrRecords"
              numberOrRecords: numberOfRecords,
              warehouseNr: warehouseNr,
            }),
            signal: AbortSignal.timeout(30000),
          },
        );

        if (!stockResponse.ok) {
          // Thrown errors are not cached — an upstream failure must not be
          // served as a result for the next 5 minutes.
          throw new Error(`Upstream API error ${stockResponse.status}`);
        }

        return stockResponse.json();
      },
      [
        "stockitems",
        clientId,
        companyNr,
        String(includeDormantItems),
        String(warehouseNr),
        String(startingRow),
        String(numberOfRecords),
      ],
      {
        revalidate: FIVE_MINUTES_S,
        tags: [`stockitems-${clientId}-${companyNr}`],
      },
    )();

    return NextResponse.json(stockData);
  } catch {
    return NextResponse.json(
      { message: "Upstream API error" },
      { status: 502 },
    );
  }
}
