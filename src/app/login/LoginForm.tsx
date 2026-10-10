"use client";
import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
export function LoginForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const password = new FormData(event.currentTarget).get("password");
    try {
      const result = await signIn("credentials", { password, redirect: false });
      if (result?.error || !result?.ok) { setError("Incorrect password. Please try again."); setPending(false); return; }
      window.location.replace("/");
    } catch { setError("Unable to sign in. Please try again."); setPending(false); }
  }
  return <form onSubmit={submit}><label htmlFor="password">Family password</label><input id="password" name="password" type="password" autoComplete="current-password" required aria-describedby={error ? "login-error" : undefined} /><button type="submit" disabled={pending}>{pending ? "Signing in…" : "Enter archive"}</button>{error && <p id="login-error" role="alert">{error}</p>}</form>;
}
