// src/server/supabase/getUserWithApiConnection.ts
import { SupabaseClient } from "@supabase/supabase-js";

interface UserApiConnection {
  clientId: string;
  apiPin: string;
  apiConnection: {
    api_base_url: string;
    api_key: string;
    company_nr: string;
  };
}

interface CachedUserData {
  data: UserApiConnection;
  expiresAt: number;
}

// API connection data rarely changes — cache it for 30 minutes per user
const userDataCache = new Map<string, CachedUserData>();

const THIRTY_MINUTES = 30 * 60 * 1000;

export async function getUserWithApiConnection(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserApiConnection | null> {
  const now = Date.now();
  const cached = userDataCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      client_id,
      api_pin,
      clients (
        client_api_connections (
          api_base_url,
          api_key,
          company_nr
        )
      )
    `,
    )
    .eq("auth_user_id", userId)
    .single();

  if (error || !data) return null;

  // Navigate the nested shape: profiles → clients → client_api_connections
  const clientsData = Array.isArray(data.clients)
    ? data.clients[0]
    : data.clients;

  const connection = Array.isArray(clientsData?.client_api_connections)
    ? clientsData.client_api_connections[0]
    : clientsData?.client_api_connections;

  if (!connection) return null;

  const result: UserApiConnection = {
    clientId: data.client_id,
    apiPin: data.api_pin,
    apiConnection: connection,
  };

  userDataCache.set(userId, { data: result, expiresAt: now + THIRTY_MINUTES });

  return result;
}
