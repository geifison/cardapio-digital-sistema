import { useCallback, useEffect, useMemo, useState } from "react";
import { httpClient } from "@/lib/http";
import { normalizeText } from "@/lib/utils";

export type Category = {
  id: number;
  name: string;
  description?: string | null;
  image_url?: string | null;
  active: number | boolean;
  display_order?: number | null;
  active_count?: number;
  inactive_count?: number;
  created_at?: string;
  updated_at?: string;
};

export type CategoryFilters = {
  search?: string;
  activeOnly?: boolean;
  inactiveOnly?: boolean;
};

export type UseCategoriesOptions = {
  initialFilters?: CategoryFilters;
  debounceMs?: number;
  autoFetch?: boolean;
};

export function useCategories(options: UseCategoriesOptions = {}) {
  const { initialFilters = {}, debounceMs = 300, autoFetch = true } = options;

  const [filters, setFilters] = useState<CategoryFilters>(initialFilters);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search || "");

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce da busca
  useEffect(() => {
    if (filters.search === undefined) return;
    const t = setTimeout(() => setDebouncedSearch(filters.search?.trim() || ""), debounceMs);
    return () => clearTimeout(t);
  }, [filters.search, debounceMs]);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Buscar ativas e inativas para manter itens visíveis após alternar status
      const res = await httpClient.get<{ success: boolean; data: Category[] }>("/categories?all=true");
      if (!res.success) throw new Error("Falha ao carregar categorias");
      setCategories(res.data || []);
    } catch (e: any) {
      setCategories([]);
      setError(e.message || "Erro ao carregar categorias");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) fetchCategories();
  }, [autoFetch, fetchCategories]);

  const filtered = useMemo(() => {
    let base = categories;

    if (filters.activeOnly) base = base.filter((c) => !!c.active);
    else if (filters.inactiveOnly) base = base.filter((c) => !c.active);

    const q = normalizeText(debouncedSearch);
    if (!q) return base;

    return base.filter((c) => [c.name, c.description]
      .filter(Boolean)
      .some((f) => normalizeText(String(f)).includes(q)));
  }, [categories, filters.activeOnly, filters.inactiveOnly, debouncedSearch]);

  const updateFilters = useCallback((next: Partial<CategoryFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
    setDebouncedSearch(initialFilters.search || "");
  }, [initialFilters]);

  const refetch = useCallback(async () => {
    await fetchCategories();
  }, [fetchCategories]);

  const createCategory = useCallback(async (payload: Partial<Category>) => {
    try {
      const res = await httpClient.post("/categories", payload as any);
      if (res.success) {
        await refetch();
        return { success: true, message: res.message };
      }
      throw new Error(res.message || "Erro ao criar categoria");
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }, [refetch]);

  const updateCategory = useCallback(async (id: number, payload: Partial<Category>) => {
    try {
      const res = await httpClient.put(`/categories/${id}`, payload as any);
      if (res.success) {
        await refetch();
        return { success: true, message: res.message };
      }
      throw new Error(res.message || "Erro ao atualizar categoria");
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }, [refetch]);

  const deleteCategory = useCallback(async (id: number) => {
    try {
      const res = await httpClient.delete(`/categories/${id}`);
      if (res.success) {
        await refetch();
        return { success: true, message: res.message };
      }
      throw new Error(res.message || "Erro ao excluir categoria");
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }, [refetch]);

  const toggleCategoryStatus = useCallback(async (id: number) => {
    try {
      const current = categories.find((c) => c.id === id);
      if (!current) throw new Error("Categoria não encontrada no estado local");
      const next = !current.active;

      // PUT no backend exige 'name' (e demais campos) — enviamos payload completo
      const payload: Partial<Category> = {
        name: current.name,
        description: current.description ?? "",
        image_url: current.image_url ?? null,
        display_order: current.display_order ?? 0,
        active: next ? 1 : 0,
      } as any;

      const res = await httpClient.put(`/categories/${id}`, payload as any);
      if (res.success) {
        await refetch();
        return { success: true, message: res.message };
      }
      throw new Error(res.message || "Erro ao alterar status");
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }, [categories, refetch]);

  const reorderCategories = useCallback(async (orders: { id: number; display_order: number }[]) => {
    try {
      const res = await httpClient.patch("/categories/reorder", { orders } as any);
      if (res.success) {
        await refetch();
        return { success: true, message: res.message };
      }
      throw new Error(res.message || "Erro ao reordenar categorias");
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }, [refetch]);

  return {
    // dados
    categories: filtered,
    loading,
    error,
    filters,

    // controles
    updateFilters,
    resetFilters,
    refetch,

    // operações
    createCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryStatus,
    reorderCategories,

    // estatísticas
    totalCategories: categories.length,
    filteredCount: filtered.length,
  };
}

export async function getCategoryById(id: number) {
  return httpClient.get(`/categories/${id}` as string) as Promise<{ success: boolean; data: Category }>;
}