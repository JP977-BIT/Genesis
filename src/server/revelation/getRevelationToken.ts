interface ApiConnection {
  api_base_url: string;
}

// Module-level cache — lives in server memory, persists between requests
interface CachedToken {
  token: string;
  expiresAt: number; // a timestamp (milliseconds) when this token goes stale
}

// We cache per client, in case different clients log into different APIs
const tokenCache = new Map<string, CachedToken>();

export async function getRevelationToken(
  clientId: string,
  apiConnection: ApiConnection,
  apiPin: string,
): Promise<string | null> {
  const now = Date.now();

  // Step 1 — Do we already have a valid token for this client?
  const cached = tokenCache.get(clientId);
  if (cached && cached.expiresAt > now) {
    return cached.token; // reuse it, skip the slow login entirely
  }

  // Step 2 — No valid token, so log in fresh
  const loginResponse = await fetch(
    `${apiConnection.api_base_url}/api/auth/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: apiPin,
        deviceId: "12345",
      }),
    },
  );

  const loginData = await loginResponse.json();

  if (!loginData.success) {
    return null; // let the caller decide how to handle a failed login
  }

  const token = loginData.data.token;

  // Step 3 — Save it to the cache with an expiry
  // We assume the token lasts ~1 hour. We expire OURS a little early (50 min)
  // as a safety buffer, so we never send a token that's about to die.
  const FIFTY_MINUTES = 50 * 60 * 1000; // in milliseconds
  tokenCache.set(clientId, {
    token,
    expiresAt: now + FIFTY_MINUTES,
  });

  return token;
}
