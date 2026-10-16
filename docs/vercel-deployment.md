# KAIZEN V1 deployment preparation

These are instructions only. No project has been deployed, pushed, or changed in
Supabase. Production launch remains NO-GO until the live checks below pass.

## Local release checks

Use Node.js 22, matching `package.json` and the installed Supabase SDK.

```sh
npm ci
npm test
npm run typecheck
npm run build
npm audit --omit=dev
```

Commit the reviewed source and `package-lock.json` only after approval. The lockfile
includes a narrowly scoped PostCSS 8.5.30 override for Next.js 15, addressing the
dependency advisories without a Next.js major upgrade. Keep the override until an
upstream compatible Next.js release includes a patched PostCSS dependency.

## Vercel settings, when deployment is approved

| Setting | Value |
| --- | --- |
| Framework | Next.js |
| Root directory | Directory containing this `package.json`: `./` if the Git repository is rooted in `kaizen-next`, otherwise `kaizen-next` |
| Node.js | 22.x |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | Framework default; no static export |

Add these variables to the intended Vercel environment **before building**:

- `NEXT_PUBLIC_SUPABASE_URL`: the correct project's HTTPS URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: its publishable key (or legacy anon key).

These are intentionally public browser configuration. Never use a service-role or
`sb_secret_` key here. Do not upload `.env.local`. Use an isolated test project for
preview tests that create or delete disposable data. Environment changes require
a new build because `NEXT_PUBLIC_` values are bundled into the client.

## Supabase production checks — still manual

1. Set Auth **Site URL** to the actual production HTTPS origin. Allow exact
   production redirect URLs ending in `/auth/confirm` and `/reset-password`.
   Register localhost/preview origins separately; do not use a broad production
   wildcard. Default PKCE email links are supported. For custom token-hash
   templates, recovery links go to `/auth/confirm?token_hash=…&type=recovery`.
2. Configure and verify custom SMTP, sender-domain verification, appropriate
   email rate limits, and confirmation/recovery delivery to real external users.
   Supabase's default SMTP is intended for testing, not a public launch.
3. Run the read-only [database audit](supabase-audit.sql). Confirm RLS on all four
   user tables, both ownership checks on UPDATE, cross-owner relationship
   protection, the existing `(user_id,name)` category constraint, and
   `subtasks.task_id → tasks.id ON DELETE CASCADE`. No schema changes are included
   or applied by this UI polish.
4. Complete the [two-account test plan](manual-testing.md), including direct
   attempts to read/change another account's known IDs. UI filtering alone is not
   evidence that RLS is correct.
5. Confirm the project's database backup/recovery arrangements and save a JSON
   application backup before launch.

The local environment was reviewed without printing secrets: HTTPS and a public
publishable key are configured; no public service-role variable was found. Hosted
SMTP, redirects, RLS, backups, and Vercel settings cannot be verified from local
environment variables.

## After an approved deployment

- Repeat signup, login, logout, recovery, persistence, task edits, lane moves,
  subtasks, deletion of a disposable task, and import/export at the final domain.
- Verify browser Back after logout cannot reveal private workspace content.
- Check iOS Safari and Android Chrome with the on-screen keyboard open. Viewport
  checks on a desktop browser do not replace real touch/keyboard testing. The
  existing editor's Status field remains available alongside desktop HTML5 drag.
- Check Vercel runtime logs for authentication or database errors. Roll back to a
  previously verified deployment if necessary; do not reset the database.

## Official references

- [Vercel build and root-directory settings](https://vercel.com/docs/builds/configure-a-build)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase production SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [PostCSS advisory and patched versions](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp)
