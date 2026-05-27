import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getClientForUser } from "@/src/server/supabase/getClientForUser";
import { getClientApiConnection } from "@/src/server/supabase/getClientApiConnection";

export async function GET() {
  const cookieStore = await cookies();

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

  // Step 1 - Get the logged in user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Step 2 - Find which client this user belongs to + their PIN
  const profile = await getClientForUser(user.id);

  if (!profile) {
    return NextResponse.json({ message: "No profile found" }, { status: 404 });
  }

  // Step 3 - Get that client's API details
  const apiConnection = await getClientApiConnection(profile.clientId);

  if (!apiConnection) {
    return NextResponse.json(
      { message: "No API connection found" },
      { status: 404 },
    );
  }

  // Step 4 - Login to the Revelation API to get a token
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

  if (!loginData.success) {
    return NextResponse.json(
      { message: "Revelation API login failed" },
      { status: 401 },
    );
  }

  const token = loginData.data.token;

  // Step 5 - Fetch companies using the token
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

  // Step 6 - Return the companies to the browser
  return NextResponse.json(companiesData);
}
