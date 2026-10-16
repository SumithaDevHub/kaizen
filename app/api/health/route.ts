
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("tasks")
      .select("id")
      .limit(1);

    if (error) {
      return NextResponse.json(
        { connected: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      connected: true,
      message: "KAIZEN database is reachable",
    });
  } catch {
    return NextResponse.json(
      { connected: false, error: "Connection failed" },
      { status: 500 }
    );
  }
}
