
"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (error) throw error;

      setMessage(
        "If this email is registered, you'll receive a password reset link."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to send recovery email."
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
          <h2>Begin again.</h2>
          <p className="kaizen-auth-subtitle">
            Enter your email to recover your account.
          </p>

          <form onSubmit={sendReset}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <button type="submit" disabled={loading}>
              {loading ? "Sending..." : "SEND RECOVERY LINK →"}
            </button>
          </form>

          {message && (
            <p role="status" className="kaizen-auth-message">
              {message}
            </p>
          )}

          <a href="/login" className="kaizen-auth-switch">
            Return to login
          </a>
        </div>
      </section>
    </main>
  );
}
