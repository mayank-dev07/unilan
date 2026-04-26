import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, setToken } from "../api/client";
import { setGqlToken } from "../api/gql";
import type { BackendUser } from "../api/types";

type AuthState = {
  user: BackendUser | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string, language?: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  // Manually commit a session — used by AuthScreen's two-step signup so the
  // user isn't shown as "logged in" until they finish (or skip) the avatar step.
  applyAuth: (token: string, user: BackendUser) => void;
  // Refreshes only the user object on the existing session (e.g. after avatar
  // upload changes user.picture).
  setUser: (user: BackendUser) => void;
  logout: () => void;
};

const STORAGE_KEY = "unilan_auth";

const AuthContext = createContext<AuthState | undefined>(undefined);

type Stored = { token: string; user: BackendUser };

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Stored;
  } catch {
    return null;
  }
}

function writeStored(s: Stored | null) {
  if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  else localStorage.removeItem(STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<BackendUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = readStored();
    if (s) {
      setToken(s.token);
      setGqlToken(s.token);
      setTokenState(s.token);
      setUserState(s.user);
      api.me().then(setUserState).catch(() => {
        writeStored(null);
        setToken(null);
        setGqlToken(null);
        setTokenState(null);
        setUserState(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const applyAuth = useCallback((tok: string, u: BackendUser) => {
    setToken(tok);
    setGqlToken(tok);
    setTokenState(tok);
    setUserState(u);
    writeStored({ token: tok, user: u });
  }, []);

  // Updates the in-memory user (and storage) without changing the token. The
  // token must already be set — caller is responsible for that ordering.
  const setUser = useCallback((u: BackendUser) => {
    setUserState(u);
    // Persist alongside the existing token so refresh keeps the new picture.
    const stored = readStored();
    if (stored) writeStored({ token: stored.token, user: u });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const r = await api.login(username, password);
    applyAuth(r.token, r.user);
  }, [applyAuth]);

  const signup = useCallback(async (username: string, password: string, language?: string) => {
    const r = await api.signup(username, password, language);
    applyAuth(r.token, r.user);
  }, [applyAuth]);

  const loginWithGoogle = useCallback(async (credential: string) => {
    const r = await api.googleAuth(credential);
    applyAuth(r.token, r.user);
  }, [applyAuth]);

  const logout = useCallback(() => {
    setToken(null);
    setGqlToken(null);
    setTokenState(null);
    setUserState(null);
    writeStored(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, token, loading, login, signup, loginWithGoogle, applyAuth, setUser, logout }),
    [user, token, loading, login, signup, loginWithGoogle, applyAuth, setUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
