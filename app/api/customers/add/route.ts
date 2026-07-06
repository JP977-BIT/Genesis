import { NextResponse, NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidateTag } from "next/cache";
import { getUserWithApiConnection } from "@/src/server/supabase/getUserWithApiConnection";
import { getRevelationToken } from "@/src/server/revelation/getRevelationToken";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();

  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: { companyNr?: string; customer?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const { companyNr, customer } = body;
  if (!companyNr || !customer) {
    return NextResponse.json(
      { message: "companyNr and customer are required" },
      { status: 400 },
    );
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
    `${apiConnection.api_base_url}/api/customers/customer/add`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ companyNr, customer }),
      signal: AbortSignal.timeout(30000),
    },
  );

  const text = await upstream.text();

  // ── Temporary diagnostic — remove once the add-client issue is resolved ──
  console.log("[customers/add] upstream status:", upstream.status);
  console.log("[customers/add] upstream body:", text.slice(0, 1000));
  // ────────────────────────────────────────────────────────────────────────

  let result: { success?: boolean; message?: string; data?: unknown };
  try {
    result = JSON.parse(text);
  } catch {
    return NextResponse.json(
      {
        message: `Upstream error ${upstream.status}: ${text.slice(0, 200)}`,
        success: false,
      },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      {
        success: false,
        message: result.message ?? `Upstream error ${upstream.status}`,
      },
      { status: 502 },
    );
  }

  if (!result.success) {
    return NextResponse.json(
      { success: false, message: result.message ?? "Failed to create client" },
      { status: 400 },
    );
  }

  // The customer list is cached for 5 minutes — hard-expire it ({ expire: 0 },
  // not "max"/SWR) so the new client appears on the next list fetch.
  revalidateTag(`customers-${clientId}-${companyNr}`, { expire: 0 });

  return NextResponse.json({ success: true, data: result.data });
}
