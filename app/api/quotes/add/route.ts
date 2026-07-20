import { NextResponse, NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getUserWithApiConnection } from "@/src/server/supabase/getUserWithApiConnection";
import { getRevelationToken } from "@/src/server/revelation/getRevelationToken";
import { friendlyRevelationMessage } from "@/src/server/revelation/friendlyMessage";

// Upstream path inferred from the documented read endpoint for sales quotes
// and the /api/stock/stockitem/add naming pattern — verify against the
// Revelation swagger before relying on it in production.
const UPSTREAM_PATH = "/api/customertransactions/salesquote/add";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();

  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: { companyNr?: string; salesQuote?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid request body" },
      { status: 400 },
    );
  }

  const { companyNr, salesQuote } = body;
  if (!companyNr || !salesQuote) {
    return NextResponse.json(
      { message: "companyNr and salesQuote are required" },
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

  const upstream = await fetch(`${apiConnection.api_base_url}${UPSTREAM_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ companyNr, salesQuote }),
    signal: AbortSignal.timeout(30000),
  });

  const text = await upstream.text();

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
        message: friendlyRevelationMessage(result.message, "create", "quote"),
      },
      { status: 502 },
    );
  }

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        message: friendlyRevelationMessage(result.message, "create", "quote"),
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}
