import { NextResponse, NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getUserWithApiConnection } from "@/src/server/supabase/getUserWithApiConnection";
import { getRevelationToken } from "@/src/server/revelation/getRevelationToken";
import { friendlyRevelationMessage } from "@/src/server/revelation/friendlyMessage";

// Verified live 2026-07-20: /api/customertransactions/salesquote/add does NOT
// exist (404). Sales quotes are created via /api/quotes/createquote, which
// assigns the next quote number itself and returns it as the response `data`
// string. It never updates an existing quote — resending a quoteNo always
// creates a new one.
const UPSTREAM_PATH = "/api/quotes/createquote";

// createquote requires a userNr; the API has no per-operator concept in this
// app, and "1" matches the userNo on quotes created by Revelation itself.
const REVELATION_USER_NR = "1";

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

  // Proven by live bisect (2026-07-20): without header ledger "Q" the upstream
  // still answers "Saved successfully" and consumes a quote number, but
  // persists NOTHING. Enforce it here so no caller can silently lose a quote.
  const guardedQuote = { ...(salesQuote as Record<string, unknown>), ledger: "Q" };

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
    body: JSON.stringify({
      companyNr,
      userNr: REVELATION_USER_NR,
      salesQuote: guardedQuote,
    }),
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
