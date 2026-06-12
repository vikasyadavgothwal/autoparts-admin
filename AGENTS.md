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
