import { NextResponse, NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getClientForUser } from "@/src/server/supabase/getClientForUser";
import { getClientApiConnection } from "@/src/server/supabase/getClientApiConnection";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();

  // Get companyNr from query params
  const { searchParams } = new URL(request.url);
  const companyNr = searchParams.get("companyNr");

  if (!companyNr) {
    return NextResponse.json(
      { message: "companyNr is required" },
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const profile = await getClientForUser(user.id);
  if (!profile)
    return NextResponse.json({ message: "No profile found" }, { status: 404 });

  const apiConnection = await getClientApiConnection(profile.clientId);
  if (!apiConnection)
    return NextResponse.json(
      { message: "No API connection found" },
      { status: 404 },
    );

  // Login to Revelation API
  const loginResponse = await fetch(
    `${apiConnection.api_base_url}/api/auth/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: profile.apiPin,
        deviceId: "12345",
      }),
    },
  );

  const loginData = await loginResponse.json();
  if (!loginData.success)
    return NextResponse.json(
      { message: "Revelation API login failed" },
      { status: 401 },
    );

  const token = loginData.data.token;

  // Fetch customers from Revelation API
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
        startingRow: 0,
        numberOrRecords: 20,
      }),
      signal: AbortSignal.timeout(30000),
    },
  );

  const responseText = await customersResponse.text();
  if (!responseText) {
    return NextResponse.json(
      { message: "Empty response from API" },
      { status: 500 },
    );
  }
  const customersData = JSON.parse(responseText);
  return NextResponse.json(customersData);
}
