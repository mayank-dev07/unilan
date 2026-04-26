import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthContext";
import { ApiError } from "../api/client";

export default function AuthScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "login") await login(username.trim(), password);
      else await signup(username.trim(), password);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-paper text-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-card border border-line rounded-md p-8">
        <div className="text-center mb-7">
          <h1 className="font-serif text-3xl tracking-tight">UNI LAN</h1>
          <p className="text-[11px] uppercase tracking-[0.25em] text-ink-dim mt-2">
            chat in our private alphabet
          </p>
        </div>

        <div className="flex border border-line rounded-sm overflow-hidden mb-5">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 py-2 text-[11px] uppercase tracking-[0.2em] transition ${
                mode === m ? "bg-accent text-accent-fg" : "text-ink-dim hover:text-ink"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            autoComplete="username"
            required
            minLength={3}
            maxLength={32}
            className="bg-paper border border-line rounded-sm px-3 py-2 text-[14px] outline-none focus:border-line-strong"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={8}
            className="bg-paper border border-line rounded-sm px-3 py-2 text-[14px] outline-none focus:border-line-strong"
          />
          {err && (
            <p className="text-[12px] text-red-500 border border-red-500/30 bg-red-500/5 rounded-sm px-3 py-2">
              {err}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="bg-accent text-accent-fg py-2 rounded-sm text-[12px] uppercase tracking-[0.2em] disabled:opacity-50"
          >
            {busy ? "..." : mode === "login" ? "log in" : "create account"}
          </button>
        </form>

        <p className="text-[10px] uppercase tracking-[0.2em] text-ink-dim text-center mt-6">
          backend → {import.meta.env.VITE_API_URL ?? "http://localhost:8080"}
        </p>
      </div>
    </div>
  );
}
