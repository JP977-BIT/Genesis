import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getClientApiConnection(clientId: string) {
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
    .from("client_api_connections")
    .select("api_base_url, api_key, company_nr")
    .eq("client_id", clientId)
    .single();

  if (error || !data) return null;

  return data;
}
