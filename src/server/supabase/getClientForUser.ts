import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getClientForUser(userId: string) {
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

  const { data, error } = await supabase
    .from("profiles")
    .select("client_id, api_pin")
    .eq("auth_user_id", userId)
    .single();

  if (error || !data) return null;

  return { clientId: data.client_id, apiPin: data.api_pin };
}
