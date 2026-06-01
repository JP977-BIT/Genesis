import { NextResponse, NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getUserWithApiConnection } from "@/src/server/supabase/getUserWithApiConnection";
import { getRevelationToken } from "@/src/server/revelation/getRevelationToken";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();

  // Read the user ID stamped by middleware — no network call needed
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

  // One round trip — profile + api connection together
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

  const companiesResponse = await fetch(
    `${apiConnection.api_base_url}/api/companies/companies`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const companiesData = await companiesResponse.json();
  return NextResponse.json(companiesData);
}
