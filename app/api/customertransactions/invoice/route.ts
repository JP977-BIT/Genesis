import { NextResponse, NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getUserWithApiConnection } from "@/src/server/supabase/getUserWithApiConnection";
import { getRevelationToken } from "@/src/server/revelation/getRevelationToken";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();

  const { searchParams } = new URL(request.url);
  const companyNr = searchParams.get("companyNr");
  const invoiceNr = searchParams.get("invoiceNr");
  const warehouseNr = searchParams.get("warehouseNr") ?? "0";

  if (!companyNr || !invoiceNr) {
    return NextResponse.json(
      { message: "companyNr and invoiceNr are required" },
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

  const upstreamRes = await fetch(
    `${apiConnection.api_base_url}/api/customertransactions/invoice`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ companyNr, invoiceNr, warehouseNr: Number(warehouseNr) }),
      signal: AbortSignal.timeout(30000),
    },
  );

  if (!upstreamRes.ok) {
    return NextResponse.json({ message: "Upstream API error" }, { status: 502 });
  }

  const data = await upstreamRes.json();
  return NextResponse.json({ success: true, data: data.data });
}
