import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { httpClient } from "@/lib/http";
import type { HttpError } from "@/lib/http";

export type User = { id: number; name: string; email: string; role: string };

type AuthContextType = {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  verify: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const verify = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await httpClient.get("/auth/verify");
      // Esperado: { success: true, data: { user, authenticated: true } }
      const u = res?.data?.user;
      setUser(u ? (u as User) : null);
    } catch (err) {
      // Erro na verificação - usuário não autenticado
      setUser(null);
      // 401 é esperado quando não autenticado
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string, remember: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      const res = await httpClient.post("/auth/login", { email, password, remember });
      // Esperado: { success: true, data: { user } }
      const u = res?.data?.user;
      if (!u) throw new Error("Resposta inesperada do servidor");
      setUser(u as User);
    } catch (err) {
      const e = err as HttpError | Error;
      const msg = (e as any)?.message || "Falha no login";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      setError(null);
      await httpClient.post("/auth/logout");
    } catch (err) {
      // mesmo em erro, limpar sessão local
    } finally {
      setUser(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const wantsAutorun = () => {
      try {
        const params = new URLSearchParams((globalThis as any)?.location?.search || "");
        const v = (params.get("autorun") || "").toString().toLowerCase();
        return v === "1" || v === "true" || v === "yes";
      } catch {
        return false;
      }
    };

    const run = async () => {
      // Manter loading durante verify + possível auto-login condicional (ambiente DEV)
      setLoading(true);
      setError(null);
      try {
        await verify();

        // Se já autenticado, nada a fazer
        try {
          const res = await httpClient.get("/auth/verify");
          const u = (res as any)?.data?.user;
          if (u) {
            setUser(u as User);
            return;
          }
        } catch {
          // segue para tentativa de auto-login
        }

        const isDev = (import.meta as any).env?.DEV === true;
        const email = (import.meta as any).env?.VITE_TEST_EMAIL;
        const password = (import.meta as any).env?.VITE_TEST_PASSWORD;

        if (!cancelled && isDev && wantsAutorun() && email && password) {
          try {
            const resp = await httpClient.post("/auth/login", { email, password, remember: true });
            const u2 = (resp as any)?.data?.user;
            if (u2) setUser(u2 as User);
          } catch (e) {
            const msg = (e as any)?.message || "Falha no login";
            setError(msg);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ user, loading, error, login, logout, verify }), [user, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}