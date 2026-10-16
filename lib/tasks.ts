
import { createClient } from "@/lib/supabase/client";

export type TaskStatus =
    | "backlog"
    | "todo"
    | "in_progress"
    | "review"
    | "completed";

export type TaskPriority =
    | "low"
    | "medium"
    | "high"
    | "urgent";

export interface TaskInput {
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    category_id?: string | null;
    planned_week?: string | null;
    due_date?: string | null;
}

export async function getTasks() {
    const supabase = createClient();

    const { data: { user }, error: sessionError } = await supabase.auth.getUser();
    if (sessionError || !user) throw new Error("Not authenticated");
    const { data, error } = await supabase
        .from("tasks")
        .select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
}

export async function createTask(input: TaskInput) {
    const supabase = createClient();

    const { data: { user }, error: authError } =
        await supabase.auth.getUser();

    if (authError || !user) {
        throw new Error("Not authenticated");
    }

    const { data, error } = await supabase
        .from("tasks")
        .insert({
            ...input,
            user_id: user.id,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateTask(
    id: string,
    updates: Partial<TaskInput>
) {
    const supabase = createClient();

    const { data: { user }, error: sessionError } = await supabase.auth.getUser();
    if (sessionError || !user) throw new Error("Not authenticated");
    const { data, error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", id).eq("user_id", user.id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteTask(id: string) {
    const supabase = createClient();

    const { data: { user }, error: sessionError } = await supabase.auth.getUser();
    if (sessionError || !user) throw new Error("Not authenticated");
    const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", id).eq("user_id", user.id);

    if (error) throw error;
}

