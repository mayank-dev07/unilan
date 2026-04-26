import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { Camera, X } from "lucide-react";
import { useAuth } from "./AuthContext";
import { useTheme } from "../theme/ThemeContext";
import { ApiError, api, setToken } from "../api/client";
import type { BackendUser } from "../api/types";
import UserAvatar from "../components/UserAvatar";
import SoftAurora from "../components/reactbits/SoftAurora";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

// Aurora pulls --color-ink (text) and --color-accent so it follows theme.
const FALLBACK_DARK = { c1: "#efede3", c2: "#5cab94" };
const FALLBACK_LIGHT = { c1: "#0f0f0f", c2: "#5cab94" };

type Pending = { token: string; user: BackendUser };

export default function AuthScreen() {
  const { applyAuth, login, loginWithGoogle } = useAuth();
  const { theme } = useTheme();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [step, setStep] = useState<"form" | "avatar">("form");
  const [pending, setPending] = useState<Pending | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const switchMode = (m: "login" | "signup") => {
    setErr(null);
    setMode(m);
  };

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(username.trim(), password);
        return;
      }
      // Signup: don't commit to AuthContext yet — go to step 2 first.
      const r = await api.signup(username.trim(), password);
      // Set the token so /me/avatar (authenticated) works during step 2.
      setToken(r.token);
      setPending({ token: r.token, user: r.user });
      setStep("avatar");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "request failed");
    } finally {
      setBusy(false);
    }
  };

  const finishWithUser = (user: BackendUser) => {
    if (!pending) return;
    applyAuth(pending.token, user);
    setPending(null);
    setStep("form");
    setUsername("");
    setPassword("");
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

          {step === "form" ? (
            <FormStep
              mode={mode}
              switchMode={switchMode}
              username={username}
              setUsername={setUsername}
              password={password}
              setPassword={setPassword}
              err={err}
              setErr={setErr}
              busy={busy}
              setBusy={setBusy}
              submit={submitForm}
              theme={theme}
              loginWithGoogle={loginWithGoogle}
            />
          ) : pending ? (
            <AvatarStep
              user={pending.user}
              onDone={finishWithUser}
              err={err}
              setErr={setErr}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------- Step 1: form ----------

function FormStep(props: {
  mode: "login" | "signup";
  switchMode: (m: "login" | "signup") => void;
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  err: string | null;
  setErr: (v: string | null) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  submit: (e: FormEvent) => void;
  theme: "light" | "dark";
  loginWithGoogle: (credential: string) => Promise<void>;
}) {
  const {
    mode, switchMode, username, setUsername, password, setPassword,
    err, setErr, busy, setBusy, submit, theme, loginWithGoogle,
  } = props;

  return (
    <>
      <div className="flex border border-line overflow-hidden mb-5 bg-paper/20 backdrop-blur-sm">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
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
    </>
  );
}

// ---------- Step 2: avatar ----------

function AvatarStep(props: {
  user: BackendUser;
  onDone: (user: BackendUser) => void;
  err: string | null;
  setErr: (v: string | null) => void;
}) {
  const { user, onDone, err, setErr } = props;
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_AVATAR_BYTES) {
      setErr("image too large (max 5MB)");
      return;
    }
    setErr(null);
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
  };

  const clearPick = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const upload = async () => {
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const r = await api.updateMyAvatar(file);
      onDone(r.user);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "upload failed");
      setBusy(false);
    }
  };

  const skip = () => {
    onDone(user);
  };

  return (
    <div className="flex flex-col items-center">
      <h2 className="font-serif text-xl mb-1">welcome, {user.username}</h2>
      <p className="text-[11px] uppercase tracking-[0.2em] text-ink-dim mb-7">
        add a profile photo
      </p>

      <div className="relative mb-5">
        <UserAvatar
          name={user.username}
          url={preview}
          size="w-24 h-24"
          textSize="text-[34px]"
        />
        <label className="absolute -bottom-1 -right-1 bg-accent text-accent-fg w-8 h-8 rounded-full flex items-center justify-center cursor-pointer ring-2 ring-card hover:opacity-90 transition">
          <Camera size={14} />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={onPick}
          />
        </label>
        {file && (
          <button
            type="button"
            onClick={clearPick}
            className="absolute -top-1 -right-1 bg-card border border-line text-ink-dim hover:text-ink w-6 h-6 rounded-full flex items-center justify-center transition"
            title="Remove"
          >
            <X size={11} />
          </button>
        )}
      </div>

      <p className="text-[10px] uppercase tracking-[0.2em] text-ink-dim mb-6">
        {file ? "looking good" : "max 5mb · jpg, png, webp, gif"}
      </p>

      <div className="flex flex-col gap-2 w-full">
        <button
          onClick={upload}
          disabled={!file || busy}
          className="bg-accent/90 hover:bg-accent text-accent-fg py-2.5 text-[12px] uppercase tracking-[0.2em] disabled:opacity-40 transition shadow-md shadow-accent/20"
        >
          {busy ? "uploading…" : "upload & continue"}
        </button>
        <button
          onClick={skip}
          disabled={busy}
          className="border border-line py-2 text-[12px] uppercase tracking-[0.2em] text-ink-dim hover:text-ink hover:border-line-strong transition"
        >
          skip for now
        </button>
      </div>

      {err && (
        <p className="mt-5 text-[12px] text-red-500 border border-red-500/30 bg-red-500/5 px-3 py-2 text-center w-full">
          {err}
        </p>
      )}
    </div>
  );
}
