# Skill: Create API Route or API-Backed Page

## Goal
Implement API route handlers and API-backed pages with clean layering.
For pages backed by write actions, also add loading and result status feedback in UI so users know when saves are in progress and successful.

## API Route (`app/api/v1/<audience>/<feature>/route.ts`)
1. Create folder: `app/api/v1/<audience>/<feature>/route.ts` where `<audience>` is one of `admin`, `user`, `fleet`, `supplier`.
2. Keep request parsing and response formatting close to the handler.
3. Keep route action calls in `actions/<audience>/<feature>/...` (or `actions/<feature>/...`) so each API maps to a feature folder.
4. Validate request data before calling action logic.
5. Return `NextResponse` with consistent status codes.

## API-Backed Page
1. Create/update route page under `app/<path>/page.tsx`.
2. If server-side fetch is needed, keep it in the page or route-level function.
3. Delegate:
   - data shaping to `services/`
   - DB/API writes/reads to feature actions in `actions/<feature>/` (or `actions/<audience>/<feature>/`)
4. Keep JSX clean; pass plain props to UI components.

## Example pattern
- `app/api/v1/admin/public-content/route.ts` -> uses `actions/admin-dashboard/public-pages/public-content.ts`
- `app/(dashboard)/pages/home-page/page.tsx` -> uses `services/admin-dashboard/public-pages/public-page-content.ts`

## Checklist
- [ ] Route path is intentional and RESTful
- [ ] `actions/` handles external side effects
- [ ] `services/` handles transformation and domain logic
- [ ] Error handling returns clear response/status
- [ ] No Prisma usage in component files
