
import { createClient } from "@/lib/supabase/client";

export type Status =
  | "Backlog"
  | "To Do"
  | "In Progress"
  | "Review"
  | "Completed";

export type Priority = "Low" | "Medium" | "High" | "Urgent";

export type KaizenTask = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: Status;
  week: string;
  due: string;
  subtasks: {
    id: string;
    text: string;
    done: boolean;
  }[];
  created: string;
};

// Validate the entire backup before any cloud writes, including nested steps.
export function validateBackup(value: unknown): asserts value is { tasks: KaizenTask[]; categories?: string[] } {
  if (!value || typeof value !== "object") throw new Error("Invalid backup");
  const data = value as { tasks?: unknown; categories?: unknown };
  const date = (v: unknown) => typeof v === "string" && (v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v));
  if (!Array.isArray(data.tasks) || data.tasks.some((t) =>
    !t || typeof t.title !== "string" || !t.title.trim() ||
    typeof t.description !== "string" || typeof t.category !== "string" || !t.category.trim() ||
    !["Backlog", "To Do", "In Progress", "Review", "Completed"].includes(t.status) ||
    !["Low", "Medium", "High", "Urgent"].includes(t.priority) ||
    !date(t.week) || !date(t.due) || typeof t.created !== "string" || Number.isNaN(Date.parse(t.created)) ||
    !Array.isArray(t.subtasks) || t.subtasks.some((s: unknown) => !s || typeof s !== "object" ||
      typeof (s as { text?: unknown }).text !== "string" || typeof (s as { done?: unknown }).done !== "boolean")
  ) || (data.categories !== undefined && (!Array.isArray(data.categories) || data.categories.some(c => typeof c !== "string" || !c.trim())))) {
    throw new Error("Invalid backup. No tasks were imported.");
  }
}

const statusToDb: Record<Status, string> = {
  Backlog: "backlog",
  "To Do": "todo",
  "In Progress": "in_progress",
  Review: "review",
  Completed: "completed",
};

const statusFromDb: Record<string, Status> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  completed: "Completed",
};

const supabase = createClient();
let accountId: string | undefined;

async function getUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Please log in to KAIZEN.");
  }

  // Never apply an old board or a queued import to a different signed-in account.
  if (accountId && accountId !== user.id) {
    throw new Error("Your account changed. Refresh before continuing.");
  }
  accountId = user.id;
  return user.id;
}

type CategoryRow = { id: string; name: string };
type TaskRow = { id: string; title: string; description: string | null; category_id: string; priority: string; status: string; planned_week: string | null; due_date: string | null; created_at: string };
type SubtaskRow = { id: string; task_id: string; title: string; is_completed: boolean; position: number };

// Supabase caps a single select response. Never export or edit a truncated board.
async function readAllRows<T>(table: string, columns: string, userId: string, taskId?: string): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase.from(table).select(columns).eq("user_id", userId).order("id");
    if (taskId) query = query.eq("task_id", taskId);
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []) as unknown as T[]);
    if (!data || data.length < pageSize) return rows;
  }
}

export async function loadCloudCategories(): Promise<string[]> {
  const userId = await getUserId();
  const rows = await readAllRows<CategoryRow>("categories", "id,name", userId);
  return rows.map(row => row.name).sort((a, b) => a.localeCompare(b));
}

export async function saveCloudCategory(name: string) {
  const userId = await getUserId();

  const { data, error } = await supabase
    .from("categories")
    .upsert(
      { user_id: userId, name },
      { onConflict: "user_id,name" }
    )
    .select("id")
    .single();

  if (error) throw error;

  return data.id as string;
}

export async function loadCloudTasks(): Promise<KaizenTask[]> {
  const userId = await getUserId();

  const [categories, tasks, subtasks] = await Promise.all([
    readAllRows<CategoryRow>("categories", "id,name", userId),
    readAllRows<TaskRow>("tasks", "*", userId),
    readAllRows<SubtaskRow>("subtasks", "*", userId),
  ]);
  const categoryMap = new Map(categories.map(row => [row.id, row.name]));
  tasks.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || a.id.localeCompare(b.id));
  subtasks.sort((a, b) => a.position - b.position);

  return (tasks ?? []).map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    category: categoryMap.get(task.category_id) ?? "Development",
    priority: (
      task.priority.charAt(0).toUpperCase() +
      task.priority.slice(1)
    ) as Priority,
    status: statusFromDb[task.status] ?? "Backlog",
    week: task.planned_week ?? "",
    due: task.due_date ?? "",
    created: task.created_at,
    subtasks: (subtasks ?? [])
      .filter((subtask) => subtask.task_id === task.id)
      .map((subtask) => ({
        id: subtask.id,
        text: subtask.title,
        done: subtask.is_completed,
      })),
  }));
}

export async function saveCloudTask(task: KaizenTask) {
  const userId = await getUserId();

  const categoryId = await saveCloudCategory(task.category);

  const { error: taskError } = await supabase
    .from("tasks")
    .upsert({
      id: task.id,
      user_id: userId,
      category_id: categoryId,
      title: task.title,
      description: task.description,
      status: statusToDb[task.status],
      priority: task.priority.toLowerCase(),
      planned_week: task.week || null,
      due_date: task.due || null,
      created_at: task.created,
    });

  if (taskError) throw taskError;

  const existing = await readAllRows<{ id: string }>("subtasks", "id", userId, task.id);

  const desiredIds = new Set(task.subtasks.map((s) => s.id));

  // Save current subtasks before removing obsolete ones.
  if (task.subtasks.length > 0) {
    const { error: saveError } = await supabase
      .from("subtasks")
      .upsert(
        task.subtasks.map((subtask, index) => ({
          id: subtask.id,
          user_id: userId,
          task_id: task.id,
          title: subtask.text,
          is_completed: subtask.done,
          position: index,
        }))
      );

    if (saveError) throw saveError;
  }

  const obsoleteIds = (existing ?? [])
    .map((row) => row.id as string)
    .filter((id) => !desiredIds.has(id));

  if (obsoleteIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("subtasks")
      .delete()
      .eq("user_id", userId)
      .eq("task_id", task.id)
      .in("id", obsoleteIds);

    if (deleteError) throw deleteError;
  }
}

// Dragging only changes scheduling/status, never a stale copy of task details.
export async function moveCloudTask(id: string, status: Status, week: string) {
  const userId = await getUserId();
  const { error } = await supabase.from("tasks")
    .update({ status: statusToDb[status], planned_week: week || null })
    .eq("user_id", userId).eq("id", id).select("id").single();
  if (error) throw error;
}

export async function deleteCloudTask(id: string) {
  const userId = await getUserId();

  // PostgreSQL deletes the parent and its ON DELETE CASCADE children in one
  // transaction. A missing cascade fails safely, leaving all records intact.
  const { error } = await supabase.from("tasks").delete()
    .eq("user_id", userId).eq("id", id).select("id").single();
  if (error) {
    if (error.code === "23503") {
      throw new Error("Task deletion was blocked by its database relationship. No subtasks were removed. Verify ON DELETE CASCADE for subtasks.task_id.");
    }
    throw error;
  }
}

function backupKey(task: KaizenTask) {
  return JSON.stringify([task.title, task.week, new Date(task.created).toISOString()]);
}

async function importId(key: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)));
  // UUID version 8: deterministic import identity, scoped to the signed-in user.
  bytes[6] = (bytes[6] & 15) | 128;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes.slice(0, 16), b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export async function importCloudBackup(value: unknown): Promise<number> {
  validateBackup(value);
  const userId = await getUserId();
  const cloud = await loadCloudTasks();
  const existingKeys = new Map(cloud.map(task => [backupKey(task), task.id]));
  const existingIds = new Set(cloud.map(task => task.id));
  let imported = 0;
  for (const task of value.tasks) {
    const key = backupKey(task);
    const id = await importId(JSON.stringify(["kaizen-import-v1", userId, key]));
    // Preserve pre-existing tasks, including imports from the older importer.
    if (existingKeys.has(key) && existingKeys.get(key) !== id) continue;
    const categoryId = await saveCloudCategory(task.category.trim());
    const { error } = await supabase.from("tasks").upsert({
      id, user_id: userId, category_id: categoryId,
      title: task.title, description: task.description,
      status: statusToDb[task.status], priority: task.priority.toLowerCase(),
      planned_week: task.week || null, due_date: task.due || null,
      created_at: task.created,
    }, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw error;
    if (task.subtasks.length) {
      const rows = await Promise.all(task.subtasks.map(async (step, position) => ({
        id: await importId(JSON.stringify([id, position, step.text])),
        user_id: userId, task_id: id, title: step.text,
        is_completed: step.done, position,
      })));
      const { error: subtaskError } = await supabase.from("subtasks")
        .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
      if (subtaskError) throw subtaskError;
    }
    if (!existingIds.has(id)) imported++;
    existingIds.add(id);
    existingKeys.set(key, id);
  }
  for (const name of value.categories ?? []) await saveCloudCategory(name.trim());
  return imported;
}
