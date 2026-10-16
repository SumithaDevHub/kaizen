
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createClient();
  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    if (error === "invalid-link" || error === "confirmation-failed") {
      setMessage("This confirmation link is invalid or expired. Request a new link and try again.");
    }
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm`,
          },
        });

        if (error) throw error;
        if (data.session) {
          window.location.assign("/");
          return;
        }

        setMessage(
          "Check your email for the confirmation link."
        );
      } else {
        const { error } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (error) throw error;

        window.location.assign("/");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Authentication failed."
      );
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
          <span className="kaizen-auth-eyebrow">
            YOUR JOURNEY BEGINS HERE
          </span>

          <h2>
            {mode === "login"
              ? "Welcome back, warrior."
              : "Begin your journey."}
          </h2>

          <p className="kaizen-auth-subtitle">
            Small steps. Unbreakable discipline.
          </p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={
                mode === "login"
                  ? "current-password"
                  : "new-password"
              }
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />

            <a href="/forgot-password">
  Forgot password?
</a>

            <button type="submit" disabled={loading}>
              {loading
                ? "Please wait..."
                : mode === "login"
                ? "ENTER KAIZEN →"
                : "CREATE ACCOUNT →"}
            </button>
          </form>

          {message && (
            <p role="status" className="kaizen-auth-message">
              {message}
            </p>
          )}

          <button
            type="button"
            className="kaizen-auth-switch"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setMessage("");
            }}
          >
            {mode === "login"
              ? "New here? Create an account"
              : "Already have an account? Sign in"}
          </button>
        </div>

        <p className="kaizen-auth-footer">
          一歩ずつ — ONE STEP AT A TIME
        </p>
      </section>
    </main>
  );
}
