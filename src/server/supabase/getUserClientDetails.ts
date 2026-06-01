import { SupabaseClient } from "@supabase/supabase-js";

export async function getUserClientDetails(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      client_id,
      clients (
        disk_number,
        name
      )
    `,
    )
    .eq("auth_user_id", userId)
    .single();

  if (error || !data) return null;

  const clients = Array.isArray(data.clients) ? data.clients[0] : data.clients;

  if (!clients) return null;

  return {
    clientId: data.client_id,
    diskNumber: clients.disk_number,
    name: clients.name,
  };
}
