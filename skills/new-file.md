# Skill: Add a New File

## Goal
Add a new file while keeping project boundaries clean and predictable.

## Steps
1. Choose the correct folder from architecture:
   - `app/` for routes/pages
   - `components/` for UI
   - `services/` for business logic
   - `actions/` for server actions (`actions/<feature>/` or `actions/<audience>/<feature>/`)
   - `lib/` for config/db/auth/util-infra
   - `hooks/` for client state/helpers
   - `types/` for contracts

2. Name the file with feature clarity:
   - `feature/page.tsx` for routes
   - `feature/action.ts` for actions
   - `feature/feature-data.ts` or `feature/feature-service.ts` for services
   - Keep component names PascalCase, hooks camelCase.

3. Add minimal public interface:
   - Export only what the caller needs.
   - Keep helpers local and unexported when possible.

4. Add/update type definitions in `types/` before or alongside implementation.
5. For any create/update flow, add loading and status state to the UI and wire `toast` feedback so users see save success/fail.
6. Add a short section in the nearest skill doc if process differs for this feature.

## Checklist
- [ ] File path follows architecture
- [ ] Imports use project aliases (`@/...`)
- [ ] No DB/client-side logic in React component files unless needed for display only
- [ ] Types are colocated in `types/`
- [ ] Naming is clear and one concern per file
