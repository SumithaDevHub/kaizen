
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [supabase] = useState(() => createClient());
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");

  const recoveryCheck = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    let active = true;
    let recoveryConfirmed = false;

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((event) => {
        if (!active) return;

        if (event === "PASSWORD_RECOVERY") {
          recoveryConfirmed = true;
          setReady(true);
          setChecking(false);
          setMessage("");
        }
      });

    async function verifyRecovery() {
      try {
        // Reuse the same verification across Strict Mode effect replays:
        // recovery tokens are single-use.
        recoveryCheck.current ??= (async () => {
          const params = new URLSearchParams(window.location.search);
          const tokenHash = params.get("token_hash");
          if (params.has("error") || new URLSearchParams(window.location.hash.slice(1)).has("error")) {
            throw new Error("Recovery link missing or expired. Request a new one.");
          }
          if (tokenHash && params.get("type") === "recovery") {
            const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
            if (error) throw error;
          }
          // The browser initializes PKCE/hash links automatically. Server
          // confirmation links also leave an authenticated session.
          const { data: { user }, error } = await supabase.auth.getUser();
          if (error) throw error;
          return !!user;
        })();
        recoveryConfirmed = await recoveryCheck.current;
        if (!active) return;

        if (recoveryConfirmed) {
          setReady(true);
          window.history.replaceState(
            {},
            "",
            window.location.pathname
          );
        } else {
          setMessage(
            "Recovery link missing or expired. Request a new one."
          );
        }
      } catch (error) {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to verify recovery link."
          );
        }
      } finally {
        if (active) setChecking(false);
      }
    }

    void verifyRecovery();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function updatePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!ready || success) return;

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setMessage("Use at least 8 characters.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setReady(false);
      setPassword("");
      setConfirmPassword("");
      setMessage("Password updated successfully.");
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) {
        setMessage("Password updated, but sign-out failed. Use Logout in your workspace to end this session.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to complete password update. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="kaizen-auth">
      <section className="kaizen-auth-panel">
        <div className="kaizen-auth-brand">
          <span className="kaizen-auth-mark">改善</span>
          <h1>KAIZEN</h1>
          <p>FORGE YOUR PROGRESS</p>
        </div>

        <div className="kaizen-auth-card">
          <h2>Renew your strength.</h2>

          <p className="kaizen-auth-subtitle">
            Choose a new password for your account.
          </p>

          {checking && <p>Verifying recovery link...</p>}

          {!checking && ready && !success && (
            <form onSubmit={updatePassword}>
              <label htmlFor="password">New password</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <label htmlFor="confirm-password">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(e.target.value)
                }
              />

              <button type="submit" disabled={loading}>
                {loading ? "Updating..." : "UPDATE PASSWORD →"}
              </button>
            </form>
          )}

          {message && (
            <p role="status" className="kaizen-auth-message">
              {message}
            </p>
          )}

          {!checking && (
            <a href={success ? "/login" : "/forgot-password"}
               className="kaizen-auth-switch">
              {success ? "Return to login" : "Request a new link"}
            </a>
          )}
        </div>
      </section>
    </main>
  );
}

