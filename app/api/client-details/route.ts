import { NextResponse, NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getUserClientDetails } from "@/src/server/supabase/getUserClientDetails";

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

  // One round trip — profile + client details together
  const clientDetails = await getUserClientDetails(supabase, userId);
  if (!clientDetails) {
    return NextResponse.json({ message: "No client found" }, { status: 404 });
  }

  return NextResponse.json(clientDetails);
}
