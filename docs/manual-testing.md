# Before deployment: live Supabase verification

Local automated tests use mocked Auth/PostgREST services and exercise the real
application components/utilities. They do not verify deployed RLS or email delivery.
No live records were changed during this review.

## Database prerequisites

Run `docs/supabase-audit.sql` in the Supabase SQL editor. It only reads metadata
and returns aggregate integrity counts; it does not alter policies or records.

- RLS must be enabled for profiles, categories, tasks, and subtasks.
- Policies must restrict reads/deletes to `auth.uid() = user_id`, and protect both
  old and new ownership on updates. Inserts require matching ownership.
- Task category references must belong to the same user, and subtask task
  references must belong to the same user. The integrity counts must be zero.
- `subtasks.task_id` must reference `tasks.id` with `ON DELETE CASCADE`.
  Deletion now uses one parent DELETE, so PostgreSQL applies cascading deletion
  atomically. If the relationship blocks deletion, the app reports the error and
  preserves the task and subtasks. No schema changes have been applied here.
- Supabase Auth must allow the application origin and its `/auth/confirm` and
  `/reset-password` redirect URLs. Category upserts require the existing unique
  constraint on `(user_id, name)`.

## Two-account check

Use two separate browser profiles/private sessions; tabs in the same browser
profile share authentication cookies.

1. Sign up test users A and B. Confirm email delivery and links. Also test a bad
   password, an expired confirmation link, and a valid login.
2. As A, create a category and task with two subtasks. Edit the title/notes,
   complete one subtask, change the planned week, and drag between lanes.
   Refresh and verify every value persists.
3. As B, verify A's category/task/subtasks are absent. Create B's own task and
   repeat the check from A's session. Using each user's authenticated client,
   attempt SELECT, UPDATE, and DELETE against the other user's known row IDs;
   expect no matching rows or a permission error. Cross-owner category/task
   references must also be rejected. Check profiles the same way.
4. Export A's backup, log out from the sidebar, and confirm `/login`. Visiting
   `/` while logged out must redirect to `/login`. Log back in and verify A's
   records remain. Do not delete either user's real data for this check.
5. Request a recovery email. Open the link, update the password, and verify the
   new password works. Test expired and reused links. Complete password changes
   yourself; no passwords or recovery tokens need to be shared in chat.
6. Delete only a deliberately created disposable test task containing subtasks.
   Verify the task and its children disappear together and the other user's
   records remain untouched.
7. Export a JSON backup and import it twice. Existing records must remain and
   repeated imports must not create duplicates. An interrupted import can be
   retried with the same file. Legacy `kaizen.tasks.v1` and
   `kaizen.categories.v1` localStorage values must remain unchanged.

## Local commands

`npm test`, `npm run typecheck`, and `npm run build`.
