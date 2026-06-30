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

  const now = new Date();
  const dateTo = now.toISOString();
  const dateFrom = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate()).toISOString();

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(
      `${apiConnection.api_base_url}/api/transactions/debtors`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyNr,
          accNo,
          startingRow: 0,
          numberOfRecords: 0,
          dateFrom,
          dateTo,
        }),
        signal: AbortSignal.timeout(30000),
      },
    );
  } catch {
    return NextResponse.json({ message: "Upstream request failed" }, { status: 502 });
  }

  // 204 No Content — upstream accepted but returned nothing
  if (upstreamRes.status === 204) {
    return NextResponse.json({ success: true, data: { transactions: [] } });
  }

  if (!upstreamRes.ok) {
    return NextResponse.json({ message: "Upstream API error" }, { status: 502 });
  }

  let data: { data?: { transactions?: { accNo: string; contra: string }[] } };
  try {
    const text = await upstreamRes.text();
    data = JSON.parse(text);
  } catch {
    return NextResponse.json({ message: "Invalid upstream response" }, { status: 502 });
  }

  const allTransactions = data?.data?.transactions ?? [];
  // Debtor transactions post to a control account (accNo) with the customer as contra.
  // The contra code carries a "D" prefix (e.g. "ADVA001" → "DADVA001").
  const filtered = allTransactions.filter(
    (t) => t.contra === `D${accNo}` || t.contra === accNo || t.accNo === accNo,
  );

  return NextResponse.json({
    success: true,
    data: { transactions: filtered },
  });
}
