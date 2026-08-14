# Project Rules
Always use App Router.
Architecture:
- app = routes
- components = UI only
- services = business logic
- actions = server actions
- hooks = client logic
- lib = prisma, auth, config
- utils = helper functions
- types = TypeScript types

Never place Prisma queries in React components.

Always call services from actions or routes.

Before modifying Next.js code, review the installed Next.js documentation.

Workflow Notes:
- Keep agent-level guidance in dedicated skill files so updates are isolated and easier to maintain.
- Skills docs live in the `skills/` folder and are organized by task type.
- Use existing project structure and existing aliases; avoid introducing a `src` folder.
- Validate every new or changed user-editable input, textarea, select, file upload, and custom input before submission/API calls; trim whitespace, prevent clearly invalid values where practical, show required fields with a red `*`, and use the existing toast/notification system for success and error feedback.

When adding anything new:
- Do not add business logic inside UI components.
- Keep route pages under `app/`.
- Keep reusable UI in `components/`.
- Keep app-specific logic in `services/`.
- Keep server-side write/read boundaries in `actions/`.
- Keep shared config/setup/auth/db in `lib/`.
- Keep pure helper utilities in `lib/` utilities folder.
- Put type contracts in `types/` matching feature path depth.

### New file creation
- New component page: place under `app/<route>/page.tsx` (and optional `loading.tsx`, `error.tsx`).
- New shared component: place in `components/<area>/...`.
- New service logic: place in `services/<feature>/...`.
- New server action: place in `actions/<feature>/...` or `actions/index.ts` if generic.
- New DB/auth/config file: place in `lib/...`.
- New utility helper: place in `lib/...` (no UI/component coupling).
- New types: place in `types/<feature>/...` and import by alias.
- If adding an API endpoint, create `app/api/v1/<audience>/<feature>/route.ts` only for actual HTTP handlers; otherwise use normal pages.
- Audience folder mapping for API routes:
  - `app/api/v1/admin/*` for admin-only APIs
  - `app/api/v1/user/*` for user APIs
  - `app/api/v1/fleet/*` for fleet APIs
  - `app/api/v1/supplier/*` for supplier APIs

### New API route policy
- Use `app/api/v1/<audience>/<feature>/route.ts` for API handlers.
- Validate request payloads and run business logic via `actions`.
- Keep service mapping/formatting in `services` and return consistent response shapes.
- Keep route handlers free of inline heavy business logic.
- Never place API routes outside `app/api/v1`.

### New functionality policy
- For any functionality end-to-end:
  1) define or update types
  2) add service data/logic
  3) add action for side effects
  4) wire page/component
  5) keep formatting concerns in UI components only

## Skills files
- [Create a new file](./skills/new-file.md)
- [Create an API page/route](./skills/api-page.md)
- [Add end-to-end functionality](./skills/new-functionality.md)

<!-- BEGIN:autoparts-pro-codex-docs -->

## AutoParts Pro App Scope

App: `auto_parts_admin`  
Role: Admin app and backend/API

### Responsibility

Admin dashboard and main backend/API surface for approvals, users, suppliers, garages, vehicles, catalog, public pages, RFQs, orders, marketplace, auth, Prisma, VIN lookup, and S3 uploads.

### Important Folders and Files

- app/(dashboard)
- app/api, app/api/v1, app/api/v2
- `actions/`
- `services/`
- `lib/auth, lib/user-auth, lib/storage, lib/17vin.ts, lib/vin-search`
- `prisma/schema.prisma, prisma.config.ts`
- `types/`
- `skills/`

### Connected Apps and Services

- All frontend apps through API routes
- Database through Prisma
- Firebase Admin/service-account auth
- S3-compatible storage for images/files
- 17VIN/VIN API integrations

### Rules for Working Here

- Read the project root `AGENTS.md` and `docs/` files before cross-app work.
- Keep changes inside `auto_parts_admin` unless the task explicitly requires another app.
- Do not change API contracts, Prisma schema, auth cookies/JWTs, Firebase config, route base paths, or shared env behavior without listing affected apps first.
- Do not mix public website, admin, user, supplier, garage, and fleet business logic unless existing imports or APIs already connect them.
- Preserve existing Next.js version guidance and local architecture rules.

### What Not to Touch Unless Explicitly Required

- Other app folders.
- Package manager files and lockfiles.
- `.env` files and secrets.
- Generated folders such as `.next` and `node_modules`.
- Backend/API or Prisma code outside this app's scope.

### Check After Changes

- Admin pages and API routes compile
- Prisma schema/API contract changes are coordinated with every frontend app
- Auth, S3, VIN, marketplace, RFQ, order, and supplier inventory flows are verified after changes
- Preferred validation: `npm run lint`, `npx tsc --noEmit`, and `npm run build` when relevant.
- Update project root `docs/AI_HANDOFF.md` after major changes.

### App-Specific Boundaries

- Own backend enforcement for accounts, users, plans, role permissions, menu visibility data, plan feature limits, device/session records, support settings, notifications, and reports.
- API handlers must verify identity, tenant/business ownership, role permissions, and plan limits server-side before any mutation or sensitive read.
- Admin UI may configure Free, Pro, and Enterprise plans, but route handlers/services must be the source of truth for enforcement.
- Visual/design standard: any newly created UI element (including button, input, select, card, modal, table, or any new pattern) must use the existing ShadCN UI system and preserve the established visual style and interaction language of the admin dashboard.

<!-- END:autoparts-pro-codex-docs -->
