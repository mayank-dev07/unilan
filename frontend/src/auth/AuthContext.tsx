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
  signup: (username: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
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
  const [user, setUser] = useState<BackendUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = readStored();
    if (s) {
      setToken(s.token);
      setGqlToken(s.token);
      setTokenState(s.token);
      setUser(s.user);
      api.me().then(setUser).catch(() => {
        writeStored(null);
        setToken(null);
        setGqlToken(null);
        setTokenState(null);
        setUser(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const apply = useCallback((tok: string, u: BackendUser) => {
    setToken(tok);
    setGqlToken(tok);
    setTokenState(tok);
    setUser(u);
    writeStored({ token: tok, user: u });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const r = await api.login(username, password);
    apply(r.token, r.user);
  }, [apply]);

  const signup = useCallback(async (username: string, password: string) => {
    const r = await api.signup(username, password);
    apply(r.token, r.user);
  }, [apply]);

  const loginWithGoogle = useCallback(async (credential: string) => {
    const r = await api.googleAuth(credential);
    apply(r.token, r.user);
  }, [apply]);

  const logout = useCallback(() => {
    setToken(null);
    setGqlToken(null);
    setTokenState(null);
    setUser(null);
    writeStored(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, token, loading, login, signup, loginWithGoogle, logout }),
    [user, token, loading, login, signup, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
