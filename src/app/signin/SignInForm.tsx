"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: String(form.get("username") || ""),
          password: String(form.get("password") || ""),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "That username or password is not right.");
        setPending(false);
        return;
      }
      router.push("/home");
      router.refresh();
    } catch {
      setError("Could not reach the app. Try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label className="field">
        Username
        <input type="text" name="username" autoComplete="username" autoFocus required />
      </label>
      <label className="field">
        Password
        <input type="password" name="password" autoComplete="current-password" required />
      </label>
      {error ? (
        <div className="error" role="alert">
          {error}
        </div>
      ) : null}
      <button className="btn accent" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
