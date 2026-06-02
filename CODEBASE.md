# Genesis — Codebase Reference

Genesis is a Next.js 16 (App Router) front-end for the Revelation Operations Suite. It authenticates users through Supabase, then proxies requests to a separate Revelation REST API that holds the actual business data (companies, customers, etc.).

---

## Architecture Overview

```
Browser
  │
  ├── Next.js Middleware (proxy.ts / middleware-client.ts)
  │     Verifies the Supabase session on every request.
  │     Stamps x-user-id header so route handlers don't need to re-verify.
  │
  ├── Page Routes (app/**/page.tsx)
  │     Client Components — rendered in the browser after hydration.
  │
  └── API Routes (app/api/**/route.ts)
        Server-only — never sent to the browser.
        Talk to Supabase (user/profile data) and the Revelation API (business data).

External services
  ├── Supabase — authentication + profile/client metadata database
  └── Revelation API — business data (companies, customers, etc.)
                        accessed over HTTP with a short-lived Bearer token
```

---

## User Flow

```
/login → /company-select → /home → /Finance (or other modules)
```

1. User enters email + password on `/login`. Supabase issues a session cookie.
2. Middleware redirects unauthenticated users to `/login` on every request.
3. User picks a company on `/company-select`. The selection is saved to `localStorage`.
4. `/home` is the main hub — a sidebar links to all modules.
5. Clicking **Finance** navigates to `/Finance`, which has its own sidebar and data.

---

## File-by-File Reference

### `proxy.ts` — Middleware entry point

**Path:** `genesis/proxy.ts`

Next.js looks for a file called `middleware.ts` at the root. This project names it `proxy.ts` and re-exports the logic from `middleware-client.ts`. The `config.matcher` tells Next.js which URLs to run it on — everything except static assets.

```
Every HTTP request → proxy.ts → middleware-client.ts → (allow / redirect)
```

---

### `src/lib/supabase/middleware-client.ts` — Session guard

**Path:** `genesis/src/lib/supabase/middleware-client.ts`

This is where the real middleware work happens. On every matched request it:

1. Strips any `x-user-id` header the browser may have sent (prevents forgery).
2. Calls `supabase.auth.getUser()` — a verified round-trip to Supabase servers (~200ms).
3. If the user is authenticated, stamps `x-user-id: <uuid>` onto the request headers.
4. Redirects unauthenticated users to `/login`, and authenticated users away from `/login` to `/company-select`.

The `x-user-id` header is the key optimisation: route handlers read this trusted header instead of calling `getUser()` again, saving one network round-trip per API call.

---

### `app/layout.tsx` — Root HTML shell

**Path:** `genesis/app/layout.tsx`

Wraps every page. Loads the Geist and Geist Mono fonts from Google, sets the page `<title>` to "Genesis", and applies global CSS. Every page in the app is a child of this layout.

---

### `app/page.tsx` — Root redirect

**Path:** `genesis/app/page.tsx`

Visiting `/` immediately redirects to `/login`. Nothing is rendered here.

---

### `app/globals.css` — Global styles

**Path:** `genesis/app/globals.css`

Tailwind CSS base, components, and utilities. Applied once via `layout.tsx`.

---

### `app/login/page.tsx` — Login page

**Path:** `genesis/app/login/page.tsx`

A client component with two controlled inputs (email + password). On submit it calls `supabase.auth.signInWithPassword()` directly from the browser using the public Supabase client (`src/lib/supabase/client.ts`). On success it redirects to `/company-select` using `window.location.replace` (a hard navigation, which forces a full page reload so the new session cookie is picked up by the middleware).

---

### `app/api/auth/login/route.ts` — FTP credential verification

**Path:** `genesis/app/api/auth/login/route.ts`

A `POST` endpoint used to verify a user's Revelation API PIN during setup/onboarding. It:

1. Receives `{ diskNumber, email, pin }` from the client.
2. Connects to an FTP server (credentials from `.env.local`).
3. Downloads the file `<email>_webconfig.json` from the client's folder on the FTP server.
4. Compares `config.API.ApiPassword` against the submitted `pin`.
5. Returns `{ success: true }` or `401 Unauthorized`.

This is not part of the normal login flow — it is a one-time verification that the user knows their Revelation PIN.

---

### `app/company-select/page.tsx` — Company picker

**Path:** `genesis/app/company-select/page.tsx`

Fetches the list of companies the user has access to from `/api/companies` and displays them as cards. When the user clicks a company:

1. The company object (name, `companyNr`, address) is saved to `localStorage` under the key `selectedCompany`.
2. `prefetchCustomers(companyNr)` is called — this fires the customer list fetch immediately in the background so the Finance page gets a head start.
3. `router.push("/home")` navigates to the home page.

---

### `app/api/companies/route.ts` — Companies API route

**Path:** `genesis/app/api/companies/route.ts`

A `GET` endpoint that:

1. Reads `x-user-id` from the middleware-stamped header.
2. Calls `getUserWithApiConnection` (one Supabase query) to get the user's Revelation API URL and PIN.
3. Gets a Revelation auth token via `getRevelationToken` (cached in memory).
4. Calls `GET /api/companies/companies` on the Revelation API.
5. Returns the result to the browser.

---

### `app/home/page.tsx` — Home hub

**Path:** `genesis/app/home/page.tsx`

The main navigation hub after login. It has:

- A collapsible sidebar listing all modules (Finance, HR, Sales, etc.). Clicking "Finance" navigates to `/Finance`; other items just set the local `activeItem` state (those modules are not yet built).
- A status bar at the bottom showing the app version, user name, disk number, selected company, and today's date.
- A logout modal that calls `supabase.auth.signOut()` then hard-redirects to `/login`.
- Two `useEffect` calls on mount: one to read the selected company from `localStorage`, another to fetch the user's email from Supabase and the disk number from `/api/client-details`.

---

### `app/api/client-details/route.ts` — Client details API route

**Path:** `genesis/app/api/client-details/route.ts`

A `GET` endpoint used by the home page to display the `disk_number` and client `name` in the status bar. It:

1. Reads `x-user-id` from the request header.
2. Creates a Supabase server client using the session cookies.
3. Calls `getUserClientDetails` (one Supabase JOIN query) to fetch profile + client data.
4. Returns `{ clientId, diskNumber, name }`.

---

### `app/Finance/page.tsx` — Finance module

**Path:** `genesis/app/Finance/page.tsx`

The Finance module shell. On mount it reads `selectedCompany` from `localStorage` and starts fetching the customer list. It first checks for a prefetched promise from `consumeCustomerPrefetch` (started on company-select); if none exists it falls back to a fresh fetch against `/api/customers`.

The customer table uses **TanStack Virtual** (`useVirtualizer`) to render only the rows visible in the viewport, regardless of how large the list is — so even thousands of customers render instantly without DOM bloat.

The sidebar (`FinanceSidebar`) controls which sub-section is shown via `activeItem` state. Currently "Clients" is the only section with data.

---

### `app/Finance/components/financeSidebar.tsx` — Finance sidebar

**Path:** `genesis/app/Finance/components/financeSidebar.tsx`

A collapsible sidebar specific to the Finance module. Wrapped in `React.memo` so it only re-renders when its props change. Nav items: Dashboard, Clients, Suppliers, Inventory, Admin, Subsidiary, Modules. The back arrow (`ChevronLeft`) navigates to `/home`. Expand/collapse is driven by mouse enter/leave, controlled by the parent page.

---

### `app/api/customers/route.ts` — Customers API route

**Path:** `genesis/app/api/customers/route.ts`

A `GET` endpoint that accepts `companyNr`, `startingRow`, and `numberOfRecords` as query parameters. It:

1. Reads `x-user-id` from the header.
2. Calls `getUserWithApiConnection` (Supabase query, cached for 30 min).
3. Checks a **module-level customer cache** — if a result for this exact query is cached and less than 5 minutes old, returns it immediately without hitting the Revelation API.
4. If not cached, calls `getRevelationToken` (Revelation login, cached in memory for 50 min).
5. Posts to `POST /api/customers/customers` on the Revelation API.
6. Stores the result in the cache and returns it.

The cache eliminates the ~1.5s Revelation API call on repeat visits within the 5-minute window.

---

### `src/lib/supabase/client.ts` — Browser Supabase client

**Path:** `genesis/src/lib/supabase/client.ts`

Exports a single `supabase` browser client created with `createBrowserClient`. Used only in client components (`login/page.tsx`, `home/page.tsx`) for operations that must happen in the browser — signing in, signing out, and reading the current user's email. Never used in API routes or server code.

---

### `src/server/supabase/getUserWithApiConnection.ts` — Profile + API connection query

**Path:** `genesis/src/server/supabase/getUserWithApiConnection.ts`

A server-side helper that fetches everything needed to call the Revelation API in **one Supabase JOIN query**: the user's `client_id`, their `api_pin`, and the client's `api_base_url`, `api_key`, and `company_nr`. Results are cached in a module-level `Map` keyed by `userId` for 30 minutes, since this data almost never changes. Used by both `/api/customers` and `/api/companies`.

---

### `src/server/supabase/getUserClientDetails.ts` — Profile + client name/disk query

**Path:** `genesis/src/server/supabase/getUserClientDetails.ts`

A server-side helper used only by `/api/client-details`. Fetches the user's `client_id` and the linked client's `disk_number` and `name` in a single JOIN query. Returns `{ clientId, diskNumber, name }`.

---

### `src/server/revelation/getRevelationToken.ts` — Revelation auth token

**Path:** `genesis/src/server/revelation/getRevelationToken.ts`

Handles authentication with the Revelation API. It maintains a module-level `Map` of tokens keyed by `clientId`. On each call it:

1. Checks if a valid cached token exists (not yet expired).
2. If yes, returns it immediately (~0.02ms).
3. If no, posts to `/api/auth/login` on the Revelation API with the user's `pin` and a fixed `deviceId`.
4. Stores the returned token with a 50-minute expiry (10 minutes before the assumed 1-hour token lifetime) and returns it.

This caching is what makes repeated API calls fast — the ~1.5s Revelation API cost only occurs on the very first request, or after the 50-minute window expires.

---

### `src/lib/prefetch/customers.ts` — Client-side prefetch store

**Path:** `genesis/src/lib/prefetch/customers.ts`

A module-level store (plain JavaScript variable, no library) that holds an in-flight customer fetch promise. Because Next.js client-side navigation does not reload the JavaScript bundle, this variable survives page transitions.

- `prefetchCustomers(companyNr)` — fires the `/api/customers` fetch immediately and stores the promise. Called on company-select when the user picks a company.
- `consumeCustomerPrefetch(companyNr)` — returns the stored promise (if the companyNr matches) and clears it. Called by the Finance page on mount.

This means the 1.5s Revelation API call runs in the background while the user is navigating through the home page, so by the time they open Finance → Clients the data is ready or nearly ready.

---

## Supabase Database Schema (inferred)

| Table | Key columns | Purpose |
|---|---|---|
| `profiles` | `auth_user_id`, `client_id`, `api_pin` | Links a Supabase auth user to a Revelation client and stores their API PIN |
| `clients` | `id`, `name`, `disk_number` | The business client (company) that owns this Genesis installation |
| `client_api_connections` | `client_id`, `api_base_url`, `api_key`, `company_nr` | The URL and credentials for the client's Revelation API server |

---

## Environment Variables (`.env.local`)

| Variable | Used by | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | All Supabase clients | The Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All Supabase clients | The Supabase anon/public key |
| `FTP_HOST` | `/api/auth/login` | FTP server hostname for config file download |
| `FTP_PORT` | `/api/auth/login` | FTP server port (default 21) |
| `FTP_USER` | `/api/auth/login` | FTP username |
| `FTP_PASSWORD` | `/api/auth/login` | FTP password |

---

## Server-side Caching Summary

| What is cached | Where | Key | TTL |
|---|---|---|---|
| Revelation auth token | `getRevelationToken.ts` | `clientId` | 50 minutes |
| User profile + API connection | `getUserWithApiConnection.ts` | `userId` | 30 minutes |
| Customer list | `app/api/customers/route.ts` | `clientId:companyNr:startingRow:numberOfRecords` | 5 minutes |

All caches use module-level `Map` objects — they live in Node.js server memory and survive between requests on the same server instance. They reset on server restart.
