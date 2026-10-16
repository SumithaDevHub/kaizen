-- Read-only metadata/data-integrity audit. No policies or records are changed.
BEGIN READ ONLY;

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('profiles', 'categories', 'tasks', 'subtasks')
  AND c.relkind = 'r';

SELECT tablename, policyname, roles, cmd, qual AS using_expression,
       with_check AS check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'categories', 'tasks', 'subtasks')
ORDER BY tablename, policyname;

SELECT c.relname AS table_name, fk.conname,
       pg_get_constraintdef(fk.oid) AS foreign_key_definition
FROM pg_constraint fk
JOIN pg_class c ON c.oid = fk.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND fk.contype = 'f'
  AND c.relname IN ('tasks', 'subtasks');

SELECT 'task/category owner mismatch' AS check_name, count(*) AS mismatches
FROM public.tasks t JOIN public.categories c ON c.id = t.category_id
WHERE t.user_id IS DISTINCT FROM c.user_id
UNION ALL
SELECT 'subtask/task owner mismatch', count(*)
FROM public.subtasks s JOIN public.tasks t ON t.id = s.task_id
WHERE s.user_id IS DISTINCT FROM t.user_id;

COMMIT;
