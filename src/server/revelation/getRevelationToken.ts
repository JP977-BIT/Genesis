import { unstable_cache } from "next/cache";

interface ApiConnection {
  api_base_url: string;
}

// Two cache layers:
//  L1 — module-level Map: free lookup, but each serverless instance has its own copy.
//  L2 — unstable_cache (Next.js data cache): persists across instances and cold
//       starts, so a fresh instance reuses a token another instance logged in for
//       instead of paying the ~300-500ms Revelation login.
interface CachedToken {
  token: string;
  expiresAt: number; // a timestamp (milliseconds) when this token goes stale
}

// We cache per client, in case different clients log into different APIs
const tokenCache = new Map<string, CachedToken>();

// Upstream tokens last ~1 hour. L2 revalidates at 40 min (stale-while-revalidate
// can briefly serve past that, still leaving ~20 min of life). L1 expires 45 min
// after the token was minted — anchored to fetchedAt, not to when we read it.
const FORTY_MINUTES_S = 40 * 60;
const FORTY_FIVE_MINUTES_MS = 45 * 60 * 1000;

async function loginToRevelation(
  baseUrl: string,
  apiPin: string,
): Promise<{ token: string; fetchedAt: number }> {
  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pin: apiPin,
      deviceId: "12345",
    }),
  });

  const loginData = await loginResponse.json();

  if (!loginData.success) {
    // Throwing keeps failures out of the cache — a bad login must not be
    // remembered for 40 minutes.
    throw new Error("Revelation API login failed");
  }

  return { token: loginData.data.token, fetchedAt: Date.now() };
}

export async function getRevelationToken(
  clientId: string,
  apiConnection: ApiConnection,
  apiPin: string,
): Promise<string | null> {
  const now = Date.now();

  const cached = tokenCache.get(clientId);
  if (cached && cached.expiresAt > now) {
    return cached.token; // reuse it, skip the slow login entirely
  }

  try {
    // The pin stays in the closure on purpose: the cache identity is the
    // client, and keying by pin would leak it into cache keys for no benefit.
    const { token, fetchedAt } = await unstable_cache(
      () => loginToRevelation(apiConnection.api_base_url, apiPin),
      ["revelation-token", clientId],
      {
        revalidate: FORTY_MINUTES_S,
        tags: [`revelation-token-${clientId}`],
      },
    )();

    tokenCache.set(clientId, {
      token,
      expiresAt: fetchedAt + FORTY_FIVE_MINUTES_MS,
    });

    return token;
  } catch {
    return null; // let the caller decide how to handle a failed login
  }
}
