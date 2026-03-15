"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Login page using Supabase email/password authentication.
 *
 * Account provisioning (AUTH-04): Josh creates team member accounts
 * directly in the Supabase dashboard under Authentication > Users.
 * No sign-up flow is needed in the app.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-display font-bold text-slate mb-1">
          Dashboard Generator
        </h1>
        <p className="text-slate-light text-sm mb-6">Live AZ Co</p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-3 border border-sand-pale rounded-lg text-slate focus:outline-none focus:border-terra mb-3"
            autoFocus
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-3 border border-sand-pale rounded-lg text-slate focus:outline-none focus:border-terra mb-4"
            required
          />
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-terra text-white py-3 rounded-lg font-semibold hover:bg-terra-dark transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "Log In"}
          </button>
        </form>
      </div>
    </div>
  );
}
