"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../../lib/api";
import Footer from "../../../components/Footer";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      localStorage.setItem("ipoTrackerAdminToken", data.token);
      router.push("/admin/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="font-display text-lg font-semibold text-ink">Admin login</h1>
      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-lg border border-border px-3 py-2.5 text-sm outline-none ring-brand/30 focus:border-brand focus:ring-2"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-border px-3 py-2.5 text-sm outline-none ring-brand/30 focus:border-brand focus:ring-2"
          required
        />
        {error && <p className="text-sm text-stale">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <Footer />
    </div>
  );
}
