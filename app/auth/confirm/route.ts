
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return NextResponse.redirect(`${origin}${error ? "/login?error=confirmation-failed" : type === "recovery" ? "/reset-password" : "/"}`);
  }

  if (!token_hash || !type ||
      !["email", "signup", "recovery"].includes(type)) {
    return NextResponse.redirect(
      `${origin}/login?error=invalid-link`
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type,
  });

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=confirmation-failed`
    );
  }

  return NextResponse.redirect(
    `${origin}${type === "recovery" ? "/reset-password" : "/"}`
  );
}
