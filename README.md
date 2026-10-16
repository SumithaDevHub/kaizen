# KAIZEN 改善 — Forge Your Progress

A subtle anime-inspired, responsive weekly Kanban application built with Next.js 15 and TypeScript.

## Features
- Five Kanban lanes, drag tasks between lanes (desktop HTML5 drag and drop)
- Weekly navigation, planning, search, categories, priorities, due dates and subtasks
- Dashboard, All Tasks, Weekly Planner, category manager
- Private Supabase cloud persistence and JSON import/export
- Original red spider lily SVG artwork and restrained Japanese-inspired ornamentation

## Run locally

Use Node.js 22, then:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deployment preparation

See [Vercel deployment instructions](docs/vercel-deployment.md). No deployment or Git push has been performed. The live Supabase checks in that document must pass before public launch.

## Storage — important

Tasks, categories, and subtasks are stored in Supabase for the authenticated user. Keep RLS enabled on all user-owned tables. The app uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`; never use a service-role key in the browser.

Settings → Import Browser Tasks reads legacy localStorage only after an explicit import action and confirmation. Browser storage has no reliable owner information, so import only your own backups. Imports preserve existing tasks, generate new IDs, and validate the backup before writing. Export backup remains available. Logout ends the current browser session without deleting tasks or backups.

Import IDs are deterministic and scoped to the signed-in user. Retrying the same backup resumes missing writes using insert-only conflict handling, preserving edits to records already in the cloud. Loads are paginated so large boards and backups are not silently truncated. Task deletion relies on the database's `subtasks.task_id → tasks.id ON DELETE CASCADE` relationship; a blocked deletion preserves all records.

In Supabase Auth URL Configuration, allow your application origins and `/auth/confirm` and `/reset-password` redirect URLs. Default PKCE confirmation links and custom `token_hash` links are supported. For custom email templates, send recovery token hashes to `/auth/confirm?token_hash=…&type=recovery`; signup links use `type=email` or `type=signup`.

The repository does not contain database policy definitions. Verify deployed RLS with two separate test users: neither should be able to select, update, or delete the other's profiles, tasks, categories, or subtasks. Insert/update policies must also prevent linking tasks to another user's categories and subtasks to another user's tasks. Application filters supplement RLS; they do not replace it.

See [the manual verification plan](docs/manual-testing.md) and [read-only database audit](docs/supabase-audit.sql). Run local checks with `npm test`, `npm run typecheck`, and `npm run build`.

## Design

Original Higanbana (red spider lily) SVG line drawings are used for the hero, sidebar, authentication backdrop, and small selected accents. The active UI uses no anime frames, characters, official logos, or third-party image assets. Archived earlier artwork remains in `public` but is not referenced by the active UI. Google Fonts have system fallbacks; core layout and controls do not depend on font downloads.
