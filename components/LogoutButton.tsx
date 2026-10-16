
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

export default function LogoutButton({ disabled = false }: { disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setLoading(true);
    setError("");

    try {
      const { error } = await createClient().auth.signOut({ scope: "local" });
      if (error) throw error;
      window.location.replace("/login");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to sign out. Please try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={logout}
        className="nav-item"
        disabled={loading || disabled}
      >
        <LogOut size={19}/><span>{loading ? "Signing out..." : "Logout"}</span>
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
