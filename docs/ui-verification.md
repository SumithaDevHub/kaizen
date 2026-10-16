# V1 UI verification — 16 October 2026

## Responsive layout checks

The actual page components were server-rendered into a temporary loopback-only QA
server using synthetic records. Auth effects and cloud writes were disabled in
this fixture. The stress data contained 100 tasks, long unbroken titles/category
names, multiline notes, and 40 subtasks in the editor.

Eleven screens were checked at each size: Login, Signup, Forgot Password, Reset
Password (form state), Overview/Dashboard, Kanban, Weekly Planner, All Tasks,
Categories, Settings, and the open task editor.

| Viewport | Screens checked | Page horizontal overflow | Clipped editor actions |
| --- | ---: | --- | --- |
| 1920 × 1080 | 11 | None | None |
| 1366 × 768 | 11 | None | None |
| 1024 × 768 | 11 | None | None |
| 768 × 1024 | 11 | None | None |
| 390 × 844 | 11 | None | None |
| 320 × 568 | 11 | None | None |
| 844 × 390 | 11 | None | None |
| 1920 × 480 | 11 | None | None |

All eight overflowing editors retained internal scrolling with visible Save and
Delete actions. Short landscape screens use natural document scrolling instead
of allowing controls to collapse the workspace. Kanban horizontal overflow is
confined to the board; vertical overflow is confined to each lane.

## Interaction and production checks

- Browser keyboard End reached the bottom Add Task button in a long Kanban lane;
  the document did not scroll.
- Keyboard End scrolled the editor body while Save/Delete remained visible.
- Tab from Export backup reached the native JSON file input and displayed a
  visible focus outline on its label. Opening a file chooser was not required.
- The actual built Login, Signup, Forgot Password, and Reset Password routes were
  checked at 320 × 568 and 844 × 390: no page horizontal overflow or inaccessible
  document content. Signup was selected through its real client-side switch.
- Nine read-only production checks passed: protected `/` and `/api/health`
  redirects, the three public auth pages, invalid confirmation redirect, both
  Higanbana SVG assets, and the application icon. Protected redirects use no-store.
- Thirty local tests cover auth handlers, task workflows, private-user filters,
  import retries, backup preservation, native drag edge scrolling, keyboard focus
  containment, Escape dismissal, and scroll-lock cleanup.
- The environment audit found HTTPS and a publishable Supabase key, no public
  service-role key, and an ignored `.env.local`. No secret values were printed.
- The production dependency audit reported zero known vulnerabilities after the
  PostCSS 8.5.30 override. Node.js is pinned to 22.x for Supabase compatibility.

## Still required before GO

These checks do not prove live RLS, email delivery, or real touch-device behavior.
Complete the [manual two-account plan](manual-testing.md), the hosted Supabase
SMTP/redirect/cascade checks, and the final-domain/device checks in the
[Vercel instructions](vercel-deployment.md). No database, deployment, or remote
repository has been changed.
