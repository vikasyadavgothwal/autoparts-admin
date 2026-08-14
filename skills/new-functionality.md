# Skill: Add New Functionality

## Goal
Add new feature logic with consistent boundaries.

## Recommended order
1. Types first
   - Add or update `types/<feature>/*` definitions.
2. Service layer
   - Add business/domain logic under `services/<feature>/`.
3. Action layer
   - Add mutations/reads requiring DB/API side effects under `actions/<feature>/` (or `actions/<audience>/<feature>/`).
   - Keep action filenames organized by feature (for example: `actions/admin-dashboard/public-pages/public-content.ts`).
4. UI layer
   - Build or update components in `components/`.
   - Every user-editable input, textarea, select, file upload, and custom input must have field-appropriate validation, red `*` markers for required fields, and input-time blocking for clearly invalid values where practical.
5. Route/page wiring
   - Wire new screens or API pages in `app/`.
   - If API is needed, place API route at `app/api/v1/<audience>/<feature>/route.ts`.
   - Route handlers should import action functions from the matching `actions/<feature>/` folder.
6. Feedback and status
   - For update actions, add `isSaving`/status states in UI state.
   - Show "Saving...", success timestamps, and failures per section or screen.
   - Use `toast.success` and `toast.error` from `sonner` to surface outcomes.
7. Trust boundary validation
   - API routes/actions/services must validate the same critical constraints before writes: required fields, max lengths, numeric ranges, date ordering, file type/size, URL/email/phone format, and trimmed text.

## Rules
- Components stay presentational where possible.
- Side effects stay in `actions`.
- Shared helpers stay in `lib/`.
- Keep naming aligned with existing feature folder naming.

## Naming convention
- `FeatureNamePage`, `FeatureItemCard`, `FeatureList` for UI
- `get...`, `normalize...`, `map...` for service helpers
- `create...`, `update...`, `delete...`, `fetch...` for actions

## Completion checklist
- [ ] No logic leakage from action into component
- [ ] Types wired through `types/`
- [ ] Import paths resolve without inline deep dependencies
- [ ] New files placed in clear feature folders
- [ ] If API is created, it is under `app/api/v1/<audience>/...`
- [ ] Editable fields validate before submit/API calls and required labels render a red `*`
- [ ] Success and error states use existing toast/notification UI
