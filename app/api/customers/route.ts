import { NextResponse, NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getUserWithApiConnection } from "@/src/server/supabase/getUserWithApiConnection";
import { getRevelationToken } from "@/src/server/revelation/getRevelationToken";

interface CachedCustomers {
  data: unknown;
  expiresAt: number;
}

// Keyed by `clientId:companyNr:startingRow:numberOfRecords`
const customersCache = new Map<string, CachedCustomers>();

const FIVE_MINUTES = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();

  const { searchParams } = new URL(request.url);
  const companyNr = searchParams.get("companyNr");
  const startingRow = parseInt(searchParams.get("startingRow") ?? "0", 10);
  const numberOfRecords = parseInt(
    searchParams.get("numberOfRecords") ?? "50",
    10,
  );

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

  // Return cached customers if still fresh — skips the 1.5s Revelation API call
  const cacheKey = `${clientId}:${companyNr}:${startingRow}:${numberOfRecords}`;
  const now = Date.now();
  const cached = customersCache.get(cacheKey);
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

  console.time("fetchCustomers");
  const customersResponse = await fetch(
    `${apiConnection.api_base_url}/api/customers/customers`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        companyNr: companyNr,
        startingRow: startingRow,
        numberOfRecords: numberOfRecords,
      }),
      signal: AbortSignal.timeout(30000),
    },
  );
  console.timeEnd("fetchCustomers");

  if (!customersResponse.ok) {
    return NextResponse.json(
      { message: "Upstream API error" },
      { status: 502 },
    );
  }

  const customersData = await customersResponse.json();
  customersCache.set(cacheKey, { data: customersData, expiresAt: now + FIVE_MINUTES });

  return NextResponse.json(customersData);
}
