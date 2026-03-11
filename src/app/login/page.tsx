"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/");
      } else {
        setError("Invalid password");
      }
    } catch {
      setError("Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center p-6">
      <div className="glass-card rounded-lg p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-lg font-semibold text-light">Dashboard Generator</h1>
          <div className="w-8 h-px bg-accent mx-auto my-3" />
          <span className="text-xs font-medium text-light-muted uppercase tracking-widest">
            Live AZ Co
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="relative mb-5">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-light-dim w-4 h-4" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full pl-10 pr-4 py-3 bg-dark-elevated border border-transparent rounded-md text-sm text-light placeholder:text-light-dim focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20"
              autoFocus
            />
          </div>
          {error && <p className="text-error text-sm mb-3">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-dark py-3 rounded-md font-semibold text-sm hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "Log In"}
          </button>
        </form>
      </div>
    </div>
  );
}
