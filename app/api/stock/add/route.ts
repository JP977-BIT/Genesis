import { NextResponse, NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidateTag } from "next/cache";
import { getUserWithApiConnection } from "@/src/server/supabase/getUserWithApiConnection";
import { getRevelationToken } from "@/src/server/revelation/getRevelationToken";
import { friendlyRevelationMessage } from "@/src/server/revelation/friendlyMessage";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();

  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: { companyNr?: string; stockItem?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid request body" },
      { status: 400 },
    );
  }

  const { companyNr, stockItem } = body;
  if (!companyNr || !stockItem) {
    return NextResponse.json(
      { message: "companyNr and stockItem are required" },
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
    `${apiConnection.api_base_url}/api/stock/stockitem/add`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ companyNr, stockItem }),
      signal: AbortSignal.timeout(30000),
    },
  );

  const text = await upstream.text();

  // Known upstream defect (confirmed live 2026-07-15, see
  // docs/revelation-stock-add-bug-report.md): the endpoint's required
  // StockPic field is a System.Drawing.Bitmap, which cannot be expressed in
  // JSON at all — null fails [Required] (400 naming StockPic) and any object
  // throws NotSupportedException (a bodiless 500). Detect both signatures at
  // response time rather than short-circuiting, so a vendor fix takes effect
  // without an app change.
  const isStockPicDefect =
    (upstream.status === 500 && !text.trim()) ||
    (upstream.status === 400 && text.includes("StockPic"));
  if (isStockPicDefect) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Stock item creation is currently unavailable: the Revelation API's add endpoint has a defect (its required StockPic field cannot be sent over JSON). Omega has to fix this on their side — a ready-to-send bug report is in docs/revelation-stock-add-bug-report.md.",
      },
      { status: 502 },
    );
  }

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
        message: friendlyRevelationMessage(result.message, "create", "stock item"),
      },
      { status: 502 },
    );
  }

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        message: friendlyRevelationMessage(result.message, "create", "stock item"),
      },
      { status: 400 },
    );
  }

  // The stock list is cached for 5 minutes — hard-expire it ({ expire: 0 },
  // not "max"/SWR) so the new item appears on the next list fetch.
  revalidateTag(`stockitems-${clientId}-${companyNr}`, { expire: 0 });

  return NextResponse.json({ success: true, data: result.data });
}
