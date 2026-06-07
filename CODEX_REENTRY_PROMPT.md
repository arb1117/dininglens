# Prompt to Hand DiningLens Back to Codex

You are Codex supervising and implementing focused improvements to DiningLens.

Repo path:

`C:\Users\arb11\Projects\dininglens`

Current status:

- Claude originally built the Expo React Native app.
- Codex reviewed it, fixed checklist issues, promoted water/exercise into context, added a campus registry, and added Harvard/HUDS support through the CS50 Dining API.
- Codex did not commit changes.
- `npx tsc --noEmit` was passing after Codex's last pass.

Read these files first:

1. `CLAUDE_HANDOFF.md`
2. `COWORK_CONTEXT_PACKET.md`
3. `CODEX_SUPERVISOR_NOTES.md`
4. `SECURITY_AND_SCALE_PLAN_FOR_CLAUDE.md`
5. `CLAUDE_WORK_AUDIT_2026-06-06.md`
6. `CODEX_SECURITY_TAKEOVER_2026-06-07.md`
7. `DEPLOYMENT_PREVIEW.md`
8. `eas.json`
9. `render.yaml`
10. `Dockerfile`
11. `src/config/api.ts`
12. `src/data/campuses.ts`
13. `src/services/menuService.ts`
14. `src/services/venueService.ts`

Then run:

```powershell
git -c safe.directory=C:/Users/arb11/Projects/dininglens -C C:\Users\arb11\Projects\dininglens status --short
npm run check
```

Important development constraints:

- Preserve Claude's existing architecture and style unless a bug requires changing it.
- Prefer expanding/perfecting existing designed features over inventing unrelated new features.
- Keep campus/provider additions in `src/data/campuses.ts` and provider-specific fetch logic in `menuService.ts`.
- Do not duplicate dining location IDs between services.
- Keep `CODEX_SUPERVISOR_NOTES.md` updated with any new changes, verification, and caveats.
- Before outside testing, prioritize the security plan: rotate exposed keys, keep secrets server-side, add backend validation/rate limits/error handling, and audit auth/authorization before any cloud user data.
- Address the highest-priority items in `CLAUDE_WORK_AUDIT_2026-06-06.md` before beta/outside testing.
- Continue from `CODEX_SECURITY_TAKEOVER_2026-06-07.md` for the latest completed security/deployability pass and remaining beta blockers.
- Hosted backend/EAS preview setup has scaffolding only. External account steps still need Andrew/Claude action.

Known caveats to revisit:

- DineOnCampus often 403s from this machine; test client-side/on-device if possible.
- Harvard CS50 provider is nutrition-aware but may perform many recipe fetches.
- Harvard coordinates are geocoded and should be field-tested.
- Expo/device smoke tests were not run during the Codex pass.
