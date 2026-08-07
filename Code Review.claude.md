AutoParts Pro Admin — Senior Code Review
Reviewer: Principal Software Engineer / Next.js Architect
Codebase: auto_parts_admin — Next.js 16 / React 19 / Prisma 7 / TypeScript
Date: 2026-08-05

1. Project Architecture
Issue A-1 — No middleware.ts exists (CRITICAL)
Problem: There is no middleware.ts file in the project root. Instead, auth gate logic lives in proxy.ts, which exports a proxy() function that is presumably called from somewhere else — but the only way Next.js respects middleware is through a file named middleware.ts (or .js) at the project root exporting a middleware function.

Impact: The token-refresh redirect logic in proxy.ts is never executed automatically by Next.js. Route protection relies entirely on the dashboard layout's getCurrentAdminSession() call. Any route that bypasses that layout (e.g., the app/(dashboard)/page.tsx itself, API routes without explicit requireAdminFromRequest()) has no centrally enforced auth guard.

Severity: 🔴 Critical

Fix:

ts

// middleware.ts (project root)
import { type NextRequest } from "next/server"
import { proxy } from "@/proxy"
export const middleware = (request: NextRequest) => proxy(request)
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
Issue A-2 — Dual, non-versioned API routes alongside versioned routes (HIGH)
Problem: The app/api/ directory contains BOTH versioned routes (/api/v1/, /api/v2/) AND completely non-versioned routes (/api/admin/, /api/supplier/, /api/marketplace/, /api/search/, /api/vin-search/). This is an API contract violation.

The AGENTS.md rule explicitly states:

"Never place API routes outside app/api/v1"

Yet app/api/admin/parts/, app/api/supplier/parts/, app/api/marketplace/, and app/api/search/ all exist outside the versioned path.

Impact: External clients (frontend apps) cannot reliably depend on a versioned contract. Breaking changes in unversioned routes cause silent failures. New developers cannot discover what's "stable" vs. experimental. Violates the team's own documented rules.

Severity: 🔴 Critical

Fix: Move all unversioned routes to app/api/v1/<audience>/<feature>/route.ts. If routes are already consumed by frontends, add versioned re-exports or redirect handlers.

Issue A-3 — Prisma queries placed directly in route handlers (HIGH)
Problem: The following API route files import db directly and run Prisma queries inline, bypassing the service/action boundary:

app/api/v1/rfqs/route.ts — db.rfq.count(...)
app/api/supplier/parts/bulk-upload/route.ts — db.supplierPart.count(...)
app/api/v1/fleet/vehicles/route.ts — db.*
app/api/v1/garage/services/route.ts — db.*
app/api/v1/admin/suppliers/[id]/documents/route.ts — db.*
Impact: Business logic is scattered across route handlers. Impossible to unit test without booting Next.js. Data access patterns are duplicated. The service abstraction is meaningless when half the Prisma calls live in routes.

Severity: 🟠 High

Fix: Extract all db.* calls from route handlers into service functions. Route handlers should only call services.

Issue A-4 — supplier-settings-service.ts is a 800-line monolith (HIGH)
Problem: 
supplier-settings-service.ts
 is 800 lines. It handles profile updates, avatar uploads, document uploads, webhook delivery, email OTP, mobile OTP, S3 signed URL generation, Firebase UID lookups, and verification row queries — all in a single file with no sub-feature decomposition.

Impact: Cannot change avatar logic without risking document logic. Cannot test independently. Impossible to onboard on in a day. Cognitive load is enormous. This is a classic God Object antipattern.

Severity: 🟠 High

Fix: Split into domain-focused files:

supplier-profile-service.ts — profile reads/writes
supplier-document-service.ts — document uploads/validation
supplier-verification-service.ts — OTP/email/mobile verification
supplier-avatar-service.ts — avatar upload/deletion
Issue A-5 — bulk-upload/route.ts is an 807-line HTTP handler (HIGH)
Problem: 
app/api/supplier/parts/bulk-upload/route.ts
 is 807 lines — a full spreadsheet parser, validation engine, image URL normalizer, and business logic orchestrator embedded in a single route handler.

This violates every principle the project AGENTS.md defines: route handlers must be free of inline heavy business logic.

Impact: Cannot test the spreadsheet parsing without an HTTP request. Logic is untestable. Any change to Excel parsing risks breaking the HTTP response contract. File size alone indicates zero maintainability.

Severity: 🟠 High

Fix: Extract to services/parts-mapping/bulk-upload-parser.ts (all spreadsheet parsing), services/parts-mapping/bulk-upload-service.ts (orchestration). The route handler should be 30–50 lines.

2. Folder Structure
Issue F-1 — types/ folder has .d.ts files mixed with feature subdirectories (MEDIUM)
Problem: The types/ folder contains both feature subdirectories (types/admin-dashboard/, types/supplier/, etc.) AND ambient declaration files at the top level: types/app-sidebar.d.ts, types/dashboard-section.d.ts, types/notification-popup.d.ts, types/swagger-jsdoc.d.ts.

These .d.ts files define concrete exported types, not global ambients. They should be .ts files inside their feature subfolder (e.g., types/admin-dashboard/sidebar.ts).

Severity: 🟡 Medium

Issue F-2 — services/ has both order/ and orders/ (MEDIUM)
Problem: services/order/ and services/orders/ both exist as separate directories. This naming inconsistency suggests unplanned growth. A new developer cannot predict where order-related logic lives.

Severity: 🟡 Medium

Fix: Consolidate to services/orders/. Enforce singular or plural consistently across ALL service folders.

Issue F-3 — app/(dashboard)/pages/ is a naming anti-pattern (LOW)
Problem: The folder app/(dashboard)/pages/ has nothing to do with Next.js concepts of "pages" — it holds public-facing CMS page editors (home, RFQ, for-business, etc.). The name pages is ambiguous and conflicts with the Pages Router mental model.

Severity: 🟡 Low

Fix: Rename to app/(dashboard)/public-pages/ or app/(dashboard)/content/ to match the intent and the services/admin-dashboard/public-pages/ naming.

3. Naming Conventions
Issue N-1 — proxy.ts exports nothing that says "middleware" (MEDIUM)
The file proxy.ts in the project root is named proxy but is actually the Next.js middleware function. This naming obscures its purpose entirely. A developer scanning the root directory will not realize this is the authentication/CORS middleware layer.

Severity: 🟡 Medium

Issue N-2 — Function FleetHomePage, FleetOrdersPage, FleetSuppliersPage in admin routes (HIGH)
Problem: Route page components in the admin dashboard are named with Fleet prefix:

ts

// app/(dashboard)/page.tsx
export default function FleetHomePage() { ... }
// app/(dashboard)/suppliers/page.tsx
export default function FleetSuppliersPage() { ... }
// app/(dashboard)/orders/page.tsx
export default function FleetOrdersPage() { ... }
// app/(dashboard)/rfqs/page.tsx
export default async function FleetRfqsPage() { ... }
This is an admin dashboard, not a fleet dashboard. These names suggest copy-paste from another app that was never renamed.

Impact: Confuses every new developer. Makes searching for components unreliable. Suggests the codebase was forked from a fleet app without cleanup.

Severity: 🟠 High

Issue N-3 — lib/parts-mapping/auth.ts is misnamed and misplaced (HIGH)
Problem: 
lib/parts-mapping/auth.ts
 contains requireAdminFromRequest, requireSupplierFromRequest, requireFleetFromRequest, requireGarageFromRequest, requireCustomerUserFromRequest, and readJsonBody. This is a global API auth middleware helper — it has nothing to do with "parts mapping." It lives in the wrong directory with the wrong name.

Impact: Auth helpers are hidden inside a feature-specific folder. Developers writing new routes won't discover these helpers and will write duplicate auth checks. requireAdminFromRequest should be in lib/auth/.

Severity: 🟠 High

Fix: Move to lib/auth/api-guard.ts and rename appropriately.

Issue N-4 — lib/17vin.ts — file named after a vendor (MEDIUM)
Problem: lib/17vin.ts is named after the third-party vendor "17VIN". This tightly couples the module name to the implementation detail. If the vendor is switched, the file name becomes incorrect.

Severity: 🟡 Medium

Fix: Rename to lib/vin-api/vin-api-client.ts or lib/vin-decoder/client.ts.

4. Next.js Best Practices
Issue NX-1 — Zero loading.tsx or error.tsx files anywhere (HIGH)
Problem: Not a single loading.tsx or error.tsx exists anywhere in the app directory. Every page that does async data fetching (dashboard, users, suppliers, etc.) has no fallback UI. If any server component throws or takes more than 200ms, users see either a blank page or an unhandled crash with Next.js default error output.

Severity: 🟠 High

Fix: Add loading.tsx skeletons for every major route segment:

tsx

// app/(dashboard)/users/loading.tsx
export default function UsersLoading() {
  return <UserTableSkeleton />;
}
Issue NX-2 — export const dynamic = "force-dynamic" on every single route and page (HIGH)
Problem: Every page and API route has export const dynamic = "force-dynamic". This disables ALL static optimization — every route is fully SSR on every request. Some of the public pages (privacy policy, terms of service, cookies settings, for-business) have no user-specific data and are prime candidates for ISR or even SSG.

Severity: 🟠 High

Fix: Audit each route. Public-facing CMS content (privacy policy, home page content) should use ISR with revalidate. Admin data (users, suppliers, orders) genuinely needs force-dynamic. Applying it blindly to everything costs performance without benefit.

Issue NX-3 — Root layout has no ThemeProvider or Suspense wrapper (MEDIUM)
Problem: The root layout wraps nothing — no <ThemeProvider>, no <Suspense>, no error boundary. next-themes is installed but not configured in the root layout. The dashboard layout also does not wrap children in <Suspense>.

Severity: 🟡 Medium

Issue NX-4 — Route pages import directly from components/, not from app/ data-fetching patterns (MEDIUM)
Problem: Route pages like app/(dashboard)/users/page.tsx simply delegate to a component:

tsx

import { UsersPage } from "@/components/admin-dashboard/users/users-page"
export default function UserManagementPage() {
  return <UsersPage />;
}
The actual data fetching lives inside the component (UsersPage is async and calls services directly). This mixes data access concerns into UI components, makes the route file meaningless, and prevents proper Suspense boundaries at the route level.

Severity: 🟡 Medium

Fix: Data fetching should happen in the route page file, then pass data as props to presentation components.

Issue NX-5 — No Metadata for inner pages (MEDIUM)
Problem: The root layout has a generic metadata export:

ts

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "The best way to manage your Admin Dashboard.",
}
No individual page exports its own metadata. In a real admin app this is less critical, but the description "The best way to manage your Admin Dashboard" is a placeholder default that should never ship.

Severity: 🟡 Medium

5. Component Architecture
Issue C-1 — Admin dashboard page component hardcodes table HTML directly (MEDIUM)
Problem: 
admin-dashboard-page.tsx
 at 193 lines renders raw <tr>/<td> elements with inline Tailwind classes repeated three times (for suppliers, RFQs, and orders tables). The same hover:bg-[#2A2A2A] row style is repeated verbatim on every <tr> while a .dashboard-table-row CSS class already exists in globals.css that has this style.

Severity: 🟡 Medium

Issue C-2 — Header hardcodes "ABC Fleet" as username (HIGH)
Problem: 
components/app-header.tsx
 line 78:

tsx

<span className="text-sm font-medium text-foreground">
  ABC Fleet
</span>
The logged-in admin's name is hardcoded as "ABC Fleet". This is a test placeholder that made it into production code. The dashboard layout already retrieves authResult from getCurrentAdminSession() — the admin's name is available and never passed to the header.

Impact: Every admin sees "ABC Fleet" as their name. This is incorrect, unprofessional, and means auth context is fetched but never used.

Severity: 🟠 High

Issue C-3 — Settings page has hardcoded form default values (HIGH)
Problem: 
app/(dashboard)/settings/page.tsx
:

tsx

<Input defaultValue="ABC Fleet" />
<Input defaultValue="ops@autopartspro.com" />
<Input defaultValue="AED" />
<Input defaultValue="America/Chicago" />
Settings values are hardcoded as defaults. There is no loading from database, no save handler wired to any action. "Save Settings" button renders but does nothing. This is an unfunctional stub delivered as a finished feature.

Severity: 🟠 High

6. State Management
Issue SM-1 — Notification unread count duplicated in two sibling components (MEDIUM)
Problem: DashboardHeader manages unreadNotifications state and passes it to both NotificationLiveListener (which sets it via SSE) and NotificationPopup (which also calls onUnreadChange). Both components fetch their own notification data independently. The count is derived two separate ways. If they disagree, the UI is inconsistent.

Severity: 🟡 Medium

7. API Layer
Issue API-1 — No consistent response envelope (HIGH)
Problem: API routes use inconsistent response shapes:

Some: { ok: true, user: ... }
Some: { ok: true, rfqs: ..., pagination: ... }
Some: { ok: true, mode: "products", summary: { ... } }
There is no shared response type. The ok flag is sometimes absent. Error shapes vary between { message: string } and { ok: false, message: string }. Consumer code must guess the shape of every endpoint.

Severity: 🟠 High

Fix: Define a shared response type:

ts

type ApiSuccess<T> = { ok: true; data: T }
type ApiError = { ok: false; message: string; code?: string }
type ApiResponse<T> = ApiSuccess<T> | ApiError
Issue API-2 — Auth check in route calls getCurrentAdminSession() which reads cookies (MEDIUM)
Problem: requireAdminFromRequest() in lib/parts-mapping/auth.ts calls getCurrentAdminSession() which uses cookies() from next/headers. This works for route handlers, but it is architecture-misleading: a function named requireAdminFromRequest should extract context from the incoming NextRequest, not from next/headers. This pattern cannot be tested without a full Next.js request context.

Severity: 🟡 Medium

Issue API-3 — Error status code is always 400 for server errors (MEDIUM)
Problem: Multiple route handlers return status: 400 for all errors, including internal server errors:

ts

// app/api/v1/admin/users/[id]/route.ts
return NextResponse.json({ ok: false, message: ... }, { status: 400 })
400 Bad Request is a client error. If the DB throws, the correct status is 500 Internal Server Error. Using 400 unconditionally hides infrastructure failures from monitoring tools that watch for 5xx errors.

Severity: 🟡 Medium

8. TypeScript Quality
Issue TS-1 — as type casts used instead of proper validation (HIGH)
Problem: Multiple places use as SomeType after JSON.parse or API calls without runtime validation:

ts

// app/(dashboard)/orders/page.tsx
const orders = JSON.parse(JSON.stringify(result.orders)) as LiveOrder[]
// app/(dashboard)/rfqs/page.tsx
const serialized = JSON.parse(JSON.stringify(rfqs)) as AdminRfq[]
// lib/auth/jwt.ts
tokenPayload = JSON.parse(decodeBase64Url(encodedPayload)) as TPayload
as is a lie to the compiler. If the data doesn't match the type, you get silent runtime errors.

Severity: 🟠 High

Fix: Use zod or a validation function to parse and validate before casting.

Issue TS-2 — JSON.parse(JSON.stringify(...)) to serialize Date objects (HIGH)
Problem: Three pages use the JSON.parse(JSON.stringify(...)) pattern to strip Date objects before passing to client components:

ts

const orders = JSON.parse(JSON.stringify(result.orders)) as LiveOrder[]
This is a hack. It destroys type safety (dates become strings silently), is slow for large datasets, and indicates that service return types are not aligned with component prop types.

Impact: Dates lose their Date type without compiler warning. The cast as LiveOrder[] then lies — LiveOrder.someDate is typed as Date but is actually string at runtime.

Severity: 🟠 High

Fix: Either:

Map dates to ISO strings in the service layer explicitly, reflected in the type
Use React's built-in serialization with use client + Suspense
Use a serialization utility with proper types
Issue TS-3 — unknown used correctly in lib/17vin.ts but raw: unknown leaks into public types (LOW)
Problem: Vin17PartCandidate.raw: unknown and Vin17VehicleCandidate.raw: unknown are included in public return types. Callers cannot use raw without type assertions. This should be an internal-only field or removed.

Severity: 🟡 Low

9. Code Quality
Issue CQ-1 — Dashboard data service contains hardcoded mock data as "real" data (CRITICAL)
Problem: 
services/admin-dashboard/dashboard/dashboard-data.ts
 contains completely hardcoded mock data:

ts

export const RFQS: readonly RFQRecord[] = [
  { id: "RFQ-901", buyer: "John Doe", part: "Brake Pads", vehicle: "2019 Toyota Camry", ... },
]
export const ORDERS: readonly OrderRecord[] = [
  { id: "ORD-901", buyer: "Jane Smith", supplier: "Acme Auto Parts", amount: "$245.99", ... },
]
export const DASHBOARD_MAIN_STATS = [
  { title: "GMV (Monthly)", value: "$248,920", note: "↑ 23% vs last month", ... },
]
This is mock data being rendered in what appears to be a production admin dashboard. KPI metrics, RFQ counts, order data, system health metrics — all fake. The dashboard is a beautiful shell with no real data.

Impact: Admins make decisions based on false information. This is not a "placeholder" — it is live fake data presented as real metrics.

Severity: 🔴 Critical

Issue CQ-2 — Reports page uses entirely hardcoded static data (CRITICAL)
Problem: 
services/admin-dashboard/reports/reports-data.ts
 contains:

Total Revenue: $439K (hardcoded string)
Total Users: 2,650 (hardcoded)
Total Orders: 3484 (hardcoded)
Growth chart data: made-up monthly figures
User distribution pie chart: percentage guesses
System health: hardcoded 99.98% uptime
Recharts components (Bar, LineChart, PieChart, YAxis, Cell) are imported directly into this file — these are UI components being used inside a service layer, which is architecturally wrong.

Severity: 🔴 Critical

Issue CQ-3 — Redundant double-write on rotationCount in session refresh (MEDIUM)
Problem: In admin-auth-service.ts refreshAdminSession(), rotationCount is written to the same value twice:

ts

// Creating fresh session:
rotationCount: existingSession.rotationCount + 1,
// Then updating old session:
rotationCount: existingSession.rotationCount + 1,  // Same value!
This is a copy-paste bug. The old session's rotationCount should probably not be incremented at all since it's being revoked, or it should track something different.

Severity: 🟡 Medium

Issue CQ-4 — console.error used as the logging strategy (MEDIUM)
Problem: All error reporting uses bare console.error. There is no structured logging, no log levels in production, no centralized error tracking integration (Sentry, Datadog, etc.). In production, console.error output goes to stdout with no correlation IDs, no request tracing, and no alerting.

Severity: 🟡 Medium

10. Security
Issue SEC-1 — IP address spoofing risk in request.ts (HIGH)
Problem: 
lib/auth/request.ts
 reads IP from:

ts

const forwarded = requestHeaders.get("x-forwarded-for")
const ipAddress = cloudflareIp || realIp || forwarded?.split(",").at(-1)?.trim()
at(-1) takes the last IP in X-Forwarded-For, which is the one added by your first proxy. This is correct for Cloudflare setups but only if Cloudflare is always in the chain. An attacker who can set arbitrary X-Forwarded-For headers can spoof any IP, bypassing IP-based session security checks used in refreshAdminSession.

Severity: 🟠 High

Issue SEC-2 — configuredOrigins() called on every request — no caching (MEDIUM)
Problem: In lib/api-cors.ts, configuredOrigins() parses process.env.USER_AUTH_ALLOWED_ORIGINS and creates a new Set<string> on every single API request:

ts

function configuredOrigins(): Set<string> {
  const configured = (process.env.USER_AUTH_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    ...
  return new Set(origins)
}
This is unnecessary CPU work on every request.

Severity: 🟡 Medium

Fix: Memoize the result:

ts

const origins = (() => {
  // compute once at module load
  return new Set<string>(...)
})()
Issue SEC-3 — first-admin endpoint has no rate limiting (HIGH)
Problem: app/api/v1/admin/first-admin/ is a bootstrap endpoint that creates the first admin account. Its only protection is checking existingCount > 0. There is no rate limiting, no IP allowlist, and no additional verification beyond a ADMIN_BOOTSTRAP_TOKEN env check (confirmed in create-first-admin.ts). If the token leaks, the endpoint can be probed freely.

Severity: 🟠 High

Issue SEC-4 — Webhook delivery is fire-and-forget with user-controlled URL (HIGH)
Problem: In supplier-settings-service.ts:

ts

async function sendWebhook(url: string | undefined, payload: Record<string, unknown>) {
  if (!url) return false;
  const response = await fetch(url, { ... })
  return response.ok
}
The url comes from a supplier's settings record. A malicious supplier could set this URL to an internal network address (http://169.254.169.254/ AWS metadata, http://localhost:6379/ Redis, etc.) to perform a Server-Side Request Forgery (SSRF) attack.

Severity: 🔴 Critical

Fix: Validate the webhook URL against an allowlist of safe schemes and hosts. Block private IP ranges before making the request.

11. Performance
Issue P-1 — listAdminSuppliers() runs await Promise.all(suppliers.map(mapSupplier)) which triggers N S3 signed URL lookups (HIGH)
Problem: In supplier-management-service.ts:

ts

export async function listAdminSuppliers(): Promise<SupplierRecord[]> {
  const suppliers = await db.user.findMany({ ... })
  return Promise.all(suppliers.map(mapSupplier))
}
mapSupplier is async and calls documentUrl(supplier.tradeLicenseImageUrl), documentUrl(supplier.vatTrnImageUrl), etc. — up to 7 async calls per supplier, all resolving URL validation. For a list of 100 suppliers, this is 700 async operations executing concurrently. In practice, documentUrl is just URL parsing (not S3 calls), but the pattern is fragile: if any of those functions later make actual network calls, performance collapses silently.

Severity: 🟡 Medium

Issue P-2 — listAdminUsers() fetches ALL users with no pagination (HIGH)
Problem:

ts

export async function listAdminUsers(): Promise<UserRecord[]> {
  const users = await db.user.findMany({
    include: userInclude,
    orderBy: [{ createdAt: "desc" }],
  })
  return users.map(mapUser)
}
No take, no skip, no cursor, no pagination. If there are 50,000 users, this query fetches every single one, maps them, and passes the entire array to the component. The component has no pagination either.

Severity: 🔴 Critical

Fix: Add server-side pagination immediately. The suppliers list has the same problem.

Issue P-3 — No caching strategy for any server data (HIGH)
Problem: No unstable_cache, no cache(), no Redis caching for read-heavy endpoints. All data is fetched fresh on every request. Dashboard KPIs (total users, total suppliers) that could be cached for 60 seconds are recomputed from DB on every page load.

Severity: 🟠 High

12. Testing Readiness
Issue T-1 — Zero tests (CRITICAL)
Problem: No test files, no test framework configuration, no testing utilities. The package.json has no test script, no Jest, no Vitest, no Playwright. This is a production codebase with no automated tests of any kind.

Severity: 🔴 Critical

Issue T-2 — Service functions have no injectable dependencies (HIGH)
Problem: Every service function directly imports db from @/lib/database/prisma:

ts

import { db } from "@/lib/database/prisma"
db is a module-level singleton. You cannot mock it without patching the module. There is no dependency injection, no interface abstraction, no repository pattern. Tests would require a real database connection.

Severity: 🟠 High

13. Scalability
At 5 pages: Acceptable
At 20 pages: Already at this level, some pain
At 100 pages: Will fail
Bottlenecks:

No pagination on any list query — DB queries collapse at scale
Hardcoded mock data means features aren't actually built
God-object service files will become unmergeable in team environments
No middleware auth means adding routes requires remembering to add manual auth guards in every layout
Route handler business logic creates a testing dead zone
At enterprise level: Not ready
The combination of no tests, no pagination, SSRF risk, hardcoded data, and an unfunctional middleware puts this project below enterprise baseline.

14. Maintainability
Would a new developer understand it in one day?

Partially. The layer separation (actions/, services/, lib/) is good in principle. The naming issue with Fleet* components, auth helpers in lib/parts-mapping/, and the non-obvious proxy.ts pattern would cause significant confusion.

Most confusing areas:

Why do route components have Fleet prefix in the admin app?
Where is the middleware? (Answer: it's never hooked up)
Why does lib/parts-mapping/auth.ts contain global auth guards?
Are the dashboard numbers real? (Answer: No, they're fake)
15. Enterprise Readiness
Vercel — No. The fake dashboard data would be caught in the first demo. No loading states. No error handling.

Shopify — No. No tests, SSRF risk, and no pagination are automatic disqualifiers.

Netflix / Google — No. Zero tests, no structured logging, no observability.

Microsoft — No. TypeScript quality issues, missing null guards, no input validation library.

16. Scoring (0–10)
Category	Score	Notes
Architecture	6	Layer separation is intentional, middleware never wired
Folder Structure	5	Mixed versioned/unversioned APIs, misnamed auth module
Naming	4	Fleet* in admin, proxy.ts, lib/parts-mapping/auth.ts
TypeScript	6	strict: true set, no any, but as casts without validation
React	6	No unnecessary client components, but missing Suspense/error
Next.js	4	No middleware, no loading states, force-dynamic overused
Scalability	3	No pagination, no caching, monolith services
Maintainability	5	Good structure intent, undermined by inconsistencies
Performance	4	Unpaginated queries, N+1 async patterns
Security	5	JWT custom impl is correct, SSRF risk, IP spoofing
Code Quality	4	Hardcoded mock data in production, 807-line route handler
Overall Score: 52/100
Biggest Strengths
Custom JWT implementation (lib/auth/jwt.ts) is correct — uses timingSafeEqual, HMAC-SHA256, proper expiry checks
Token rotation pattern in refreshAdminSession follows security best practices (family token ID, revoke-on-use)
Layer separation intent — actions/, services/, lib/, types/ structure is architecturally sound
Tailwind CSS design system in globals.css — semantic CSS variables, component classes properly defined
Prisma usage — satisfies Prisma.UserInclude, UserGetPayload for inference — advanced and correct
Biggest Weaknesses
Dashboard and Reports are displaying completely fabricated data — critical integrity failure
Middleware (proxy.ts) is never registered — auth refresh logic is dead code
No tests of any kind
No pagination on user/supplier list queries
SSRF vulnerability via user-controlled webhook URL
807-line route handler with embedded business logic
Hardcoded "ABC Fleet" username in the header
No loading.tsx or error.tsx anywhere
Fleet* named components in an admin app
db imported directly in route handlers bypassing service layer
Top 20 Improvements (Highest Impact First)
Wire proxy.ts as middleware.ts — auth refresh is currently dead, token expiry is not handled at the edge
Replace all hardcoded mock data in dashboard-data.ts and reports-data.ts with real DB queries
Add pagination to listAdminUsers() and listAdminSuppliers() — will crash in production with real user volumes
Fix SSRF vulnerability in sendWebhook() — validate/allowlist URLs before making server-side fetch
Add Vitest + testing infrastructure — start with service-layer unit tests
Move all db.* calls out of route handlers into service functions
Fix lib/parts-mapping/auth.ts — rename to lib/auth/api-guard.ts, remove from parts-mapping
Move all unversioned API routes into app/api/v1/<audience>/
Rename Fleet* route components to Admin* throughout the admin app
Fix the hardcoded "ABC Fleet" in the header — pass admin name from layout session
Add loading.tsx skeletons to all major route segments
Add error.tsx error boundaries to all major route segments
Fix error status codes — 500 for server errors, 400 only for client errors
Extract bulk-upload/route.ts (807 lines) into service functions
Split supplier-settings-service.ts (800 lines) into focused modules
Define a shared API response type — ApiResponse<T> envelope
Add Zod validation — replace as Type casts after JSON.parse
Memoize configuredOrigins() — avoid per-request env parsing
Replace JSON.parse(JSON.stringify(...)) pattern with explicit serialization
Add structured logging — replace console.error with a logging library
Technical Debt Level
🔴 HIGH
The architecture intent is good, but the execution has significant gaps. Multiple critical features (dashboard metrics, reports) are stubs displaying fake data. The middleware is unregistered. Security vulnerabilities exist. No tests. These are not minor cleanups — they are fundamental gaps that must be addressed before this system can responsibly serve real users or real admin decisions.

Would you approve this project for production?
❌ No
Justification:

The authentication token-refresh middleware is dead code — it was written but never hooked into Next.js. The primary admin dashboard shows completely fabricated KPI numbers as if they were real data (a major deception risk if stakeholders view the dashboard). The Reports page is 100% hardcoded fiction. There is no pagination on the most data-heavy queries, meaning the first time a real customer base loads the users page with thousands of records, the server will OOM or timeout. An SSRF vulnerability allows any approved supplier to probe internal network resources. There are zero automated tests.

The JWT auth implementation, the token rotation scheme, the Prisma type patterns, and the CSS design system are genuinely good. But good foundations do not compensate for a dashboard that lies to its operators, a middleware that doesn't run, and no safety net of tests. This cannot go to production in its current state.

