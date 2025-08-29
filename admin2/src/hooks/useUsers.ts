import { useCallback, useEffect, useMemo, useState } from "react";
import { httpClient } from "@/lib/http";
import { normalizeText } from "@/lib/utils";

export type User = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "manager" | "operator" | string;
  created_at?: string;
  updated_at?: string;
};

export type ApiResponse<T> = { success: boolean; message?: string; data: T };

export type UserInput = {
  name: string;
  email: string;
  role: "admin" | "manager" | "operator" | string;
  password?: string; // opcional no update
};

export type UseUsersOptions = {
  autoFetch?: boolean;
  debounceMs?: number;
};

export function useUsers(options: UseUsersOptions = {}) {
  const { autoFetch = true, debounceMs = 300 } = options;

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), debounceMs);
    return () => clearTimeout(t);
  }, [search, debounceMs]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await httpClient.get<ApiResponse<User[]>>("/users");
      if (!res.success) throw new Error(res.message || "Falha ao carregar usuários");
      setUsers(res.data || []);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar usuários");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) fetchUsers();
  }, [autoFetch, fetchUsers]);

  const filtered = useMemo(() => {
    const q = normalizeText(debouncedSearch);
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.email, u.role]
        .filter(Boolean)
        .some((f) => normalizeText(String(f)).includes(q))
    );
  }, [users, debouncedSearch]);

  const refetch = useCallback(async () => {
    await fetchUsers();
  }, [fetchUsers]);

  const createUser = useCallback(async (payload: UserInput) => {
    try {
      const res = await httpClient.post<ApiResponse<any>, UserInput>("/users/create", payload);
      if (!res.success) throw new Error(res.message || "Erro ao criar usuário");
      await refetch();
      return { success: true, message: res.message || "Usuário criado com sucesso" };
    } catch (e: any) {
      return { success: false, message: e.message || "Erro ao criar usuário" };
    }
  }, [refetch]);

  const updateUser = useCallback(async (id: number, payload: UserInput) => {
    try {
      const res = await httpClient.post<ApiResponse<any>, any>("/users/update", { id, ...payload });
      if (!res.success) throw new Error(res.message || "Erro ao atualizar usuário");
      await refetch();
      return { success: true, message: res.message || "Usuário atualizado com sucesso" };
    } catch (e: any) {
      return { success: false, message: e.message || "Erro ao atualizar usuário" };
    }
  }, [refetch]);

  const deleteUser = useCallback(async (id: number) => {
    try {
      const res = await httpClient.post<ApiResponse<any>, any>("/users/delete", { id });
      if (!res.success) throw new Error(res.message || "Erro ao excluir usuário");
      await refetch();
      return { success: true, message: res.message || "Usuário excluído com sucesso" };
    } catch (e: any) {
      return { success: false, message: e.message || "Erro ao excluir usuário" };
    }
  }, [refetch]);

  return {
    users: filtered,
    loading,
    error,
    search,
    setSearch,
    refetch,
    createUser,
    updateUser,
    deleteUser,
    total: users.length,
    filteredCount: filtered.length,
  };
}