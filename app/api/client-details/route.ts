import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getClientForUser } from "@/src/server/supabase/getClientForUser";
import { getClientDetails } from "@/src/server/supabase/getClientDetails";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const profile = await getClientForUser(user.id);
  if (!profile)
    return NextResponse.json({ message: "No profile found" }, { status: 404 });

  const clientDetails = await getClientDetails(profile.clientId);
  if (!clientDetails)
    return NextResponse.json({ message: "No client found" }, { status: 404 });

  return NextResponse.json(clientDetails);
}
