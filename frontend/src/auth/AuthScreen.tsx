import { useEffect, useState, type FormEvent } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "./AuthContext";
import { useTheme } from "../theme/ThemeContext";
import { ApiError } from "../api/client";
import SoftAurora from "../components/reactbits/SoftAurora";

// Aurora pulls `--color-ink` (high-contrast text color) and `--color-accent`
// from the theme — both stay visible in light and dark, unlike paper which
// goes near-black in dark mode and contributes nothing to additive blending.
const FALLBACK_DARK = { c1: "#efede3", c2: "#5cab94" };
const FALLBACK_LIGHT = { c1: "#0f0f0f", c2: "#5cab94" };

export default function AuthScreen() {
  const { login, signup, loginWithGoogle } = useAuth();
  const { theme } = useTheme();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Pull aurora colors from the live theme tokens so the background follows
  // light/dark toggles without re-importing palette constants here.
  const [auroraColors, setAuroraColors] = useState(
    theme === "dark" ? FALLBACK_DARK : FALLBACK_LIGHT,
  );
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const c1 = cs.getPropertyValue("--color-ink").trim()
      || (theme === "dark" ? FALLBACK_DARK.c1 : FALLBACK_LIGHT.c1);
    const c2 = cs.getPropertyValue("--color-accent").trim()
      || FALLBACK_DARK.c2;
    setAuroraColors({ c1, c2 });
  }, [theme]);

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
    <div className="relative min-h-screen w-screen bg-paper text-ink overflow-hidden">
      <div className="absolute inset-0 z-0">
        <SoftAurora
          speed={0.6}
          scale={1.5}
          brightness={1}
          color1={auroraColors.c1}
          color2={auroraColors.c2}
          noiseFrequency={2.5}
          noiseAmplitude={1}
          bandHeight={0.5}
          bandSpread={1}
          octaveDecay={0.1}
          layerOffset={0}
          colorSpeed={1}
          enableMouseInteraction={false}
          mouseInfluence={0.25}
        />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-card/25 backdrop-blur-2xl border border-line p-8 shadow-2xl ring-1 ring-white/5">
          <div className="text-center mb-7">
            <h1 className="font-serif text-3xl tracking-tight">UNI LAN</h1>
            <p className="text-[11px] uppercase tracking-[0.25em] text-ink-dim mt-2">
              chat in our private alphabet
            </p>
          </div>

          <div className="flex border border-line overflow-hidden mb-5 bg-paper/20 backdrop-blur-sm">
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
              className="bg-paper/30 backdrop-blur-sm border border-line px-3 py-2 text-[14px] outline-none focus:border-line-strong focus:bg-paper/50 transition"
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={8}
              className="bg-paper/30 backdrop-blur-sm border border-line px-3 py-2 text-[14px] outline-none focus:border-line-strong focus:bg-paper/50 transition"
            />
            <button
              type="submit"
              disabled={busy}
              className="bg-accent/90 hover:bg-accent text-accent-fg py-2.5 text-[12px] uppercase tracking-[0.2em] disabled:opacity-50 transition shadow-md shadow-accent/20"
            >
              {busy ? "..." : mode === "login" ? "log in" : "create account"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <span className="flex-1 h-px bg-line" />
            <span className="text-[10px] uppercase tracking-[0.25em] text-ink-dim">or</span>
            <span className="flex-1 h-px bg-line" />
          </div>

          <div className="flex justify-center">
            <GoogleLogin
              theme={theme === "dark" ? "filled_black" : "outline"}
              size="large"
              shape="rectangular"
              text="continue_with"
              onSuccess={async (resp) => {
                if (!resp.credential) {
                  setErr("no credential returned");
                  return;
                }
                setErr(null);
                setBusy(true);
                try {
                  await loginWithGoogle(resp.credential);
                } catch (e) {
                  setErr(e instanceof ApiError ? e.message : "google sign in failed");
                } finally {
                  setBusy(false);
                }
              }}
              onError={() => setErr("google sign in failed")}
            />
          </div>

          {err && (
            <p className="mt-5 text-[12px] text-red-500 border border-red-500/30 bg-red-500/5 px-3 py-2 text-center">
              {err}
            </p>
          )}
          
        </div>
      </div>
    </div>
  );
}
