// Fetches one sales quote with its full line items. Modelled on
// app/api/customertransactions/invoice/route.ts. Uncached — the editor must
// always open the latest version of a quote.
import { NextResponse, NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getUserWithApiConnection } from "@/src/server/supabase/getUserWithApiConnection";
import { getRevelationToken } from "@/src/server/revelation/getRevelationToken";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();

  const { searchParams } = new URL(request.url);
  const companyNr = searchParams.get("companyNr");
  const quoteNr = searchParams.get("quoteNr");

  if (!companyNr || !quoteNr) {
    return NextResponse.json(
      { message: "companyNr and quoteNr are required" },
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

  const upstream = await fetch(`${apiConnection.api_base_url}/api/quotes/quote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ companyNr, quoteNr }),
    signal: AbortSignal.timeout(30000),
  });

  if (!upstream.ok) {
    return NextResponse.json({ message: "Upstream API error" }, { status: 502 });
  }

  // A bodyless 204 is Revelation's "not found" for quote reads.
  const text = await upstream.text();
  if (upstream.status === 204 || text.trim() === "") {
    return NextResponse.json({ message: "Quote not found" }, { status: 404 });
  }

  let parsed: { data?: { quote?: unknown } };
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ message: "Upstream API error" }, { status: 502 });
  }

  if (!parsed.data?.quote) {
    return NextResponse.json({ message: "Quote not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: { quote: parsed.data.quote } });
}
