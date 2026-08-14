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
5. For any create/update flow, add loading and status state to the UI and wire existing `toast` feedback so users see save success/fail.
6. For any new user-editable input, textarea, select, file upload, or custom input, add field-appropriate validation before submit/API calls, mark required labels with a red `*`, trim unnecessary whitespace, and prevent clearly invalid input characters where practical.
7. Add a short section in the nearest skill doc if process differs for this feature.

## Checklist
- [ ] File path follows architecture
- [ ] Imports use project aliases (`@/...`)
- [ ] No DB/client-side logic in React component files unless needed for display only
- [ ] Types are colocated in `types/`
- [ ] Naming is clear and one concern per file
- [ ] Editable fields have validation, red required markers, and toast feedback where actions can succeed/fail
