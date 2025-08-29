import { useState, useEffect, useMemo, useCallback } from "react";
import { httpClient } from "@/lib/http";
import { normalizeText } from "@/lib/utils";

export type Category = {
  id: number;
  name: string;
  active: number | boolean;
};

export type Product = {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  category_id: number | null;
  category_name?: string | null;
  active: number | boolean;
  product_type?: string | null;
  display_order?: number | null;
  image_url?: string | null;
  is_vegetarian?: number | boolean;
  is_vegan?: number | boolean;
  is_gluten_free?: number | boolean;
  is_spicy?: number | boolean;
  preparation_time?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type ProductFilters = {
  search?: string;
  categoryId?: string;
  activeOnly?: boolean;
  // novo: filtro client-side para mostrar apenas inativos
  inactiveOnly?: boolean;
};

export type UseProductsOptions = {
  initialFilters?: ProductFilters;
  debounceMs?: number;
  autoFetch?: boolean;
};

export function useProducts(options: UseProductsOptions = {}) {
  const {
    initialFilters = {},
    debounceMs = 300,
    autoFetch = true,
  } = options;

  // Estado dos filtros
  const [filters, setFilters] = useState<ProductFilters>(initialFilters);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search || "");

  // Estado dos dados
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce para busca
  useEffect(() => {
    if (filters.search === undefined) return;
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search?.trim() || "");
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [filters.search, debounceMs]);

  // Carregar categorias uma vez
  useEffect(() => {
    let mounted = true;
    const fetchCategories = async () => {
      try {
        const response = await httpClient.get<{ success: boolean; data: Category[] }>(
          "/categories?all=true"
        );
        if (mounted && response.success) {
          setCategories(response.data || []);
        }
      } catch (err: any) {
        if (mounted) {
          console.error("Erro ao carregar categorias:", err);
        }
      }
    };

    fetchCategories();
    return () => {
      mounted = false;
    };
  }, []);

  // Carregar produtos baseado nos filtros (apenas filtros remotos)
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let url = "/products";
      const params: string[] = [];

      // Filtro por categoria
      if (filters.categoryId) {
        params.push(`category_id=${encodeURIComponent(filters.categoryId)}`);
      }

      // Filtro por status ativo (servidor pode ignorar; manter por compatibilidade)
      if (filters.activeOnly) {
        params.push("active=true");
      }

      if (params.length > 0) {
        url += `?${params.join("&")}`;
      }

      const response = await httpClient.get<{ success: boolean; data: Product[] }>(url);

      if (response.success) {
        setProducts(response.data || []);
      } else {
        throw new Error("Falha ao carregar produtos");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao carregar produtos");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [filters.categoryId, filters.activeOnly]);

  // Auto-fetch quando filtros remotos mudam
  useEffect(() => {
    if (autoFetch) {
      fetchProducts();
    }
  }, [fetchProducts, autoFetch]);

  // Filtros locais (status e busca por texto)
  const filteredProducts = useMemo(() => {
    let base = products;

    // Filtro por status (client-side)
    if (filters.activeOnly) {
      base = base.filter((p) => !!p.active);
    } else if (filters.inactiveOnly) {
      base = base.filter((p) => !p.active);
    }

    // Filtro por texto (acentos ignorados)
    const q = normalizeText(debouncedSearch);
    if (!q) return base;

    return base.filter((product) =>
      [product.name, product.description, product.category_name]
        .filter(Boolean)
        .some((field) => normalizeText(String(field)).includes(q))
    );
  }, [products, debouncedSearch, filters.activeOnly, filters.inactiveOnly]);

  // Funções de controle
  const updateFilters = useCallback((newFilters: Partial<ProductFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
    setDebouncedSearch(initialFilters.search || "");
  }, [initialFilters]);

  const refetch = useCallback(() => {
    return fetchProducts();
  }, [fetchProducts]);

  // Operações CRUD
  const deleteProduct = useCallback(async (id: number) => {
    try {
      const response = await httpClient.delete(`/products/${id}`);
      if (response.success) {
        await refetch();
        return { success: true, message: response.message };
      }
      throw new Error(response.message || "Erro ao excluir produto");
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }, [refetch]);

  const toggleProductStatus = useCallback(async (id: number) => {
    try {
      const response = await httpClient.patch(`/products/${id}/toggle`);
      if (response.success) {
        await refetch();
        return { success: true, message: response.message };
      }
      throw new Error(response.message || "Erro ao alterar status");
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }, [refetch]);

  return {
    // Estado
    products: filteredProducts,
    categories,
    loading,
    error,
    filters,
    
    // Controles
    updateFilters,
    resetFilters,
    refetch,
    
    // Operações
    deleteProduct,
    toggleProductStatus,
    
    // Estatísticas
    totalProducts: products.length,
    filteredCount: filteredProducts.length,
  };
}


export type ApiResponse<T> = { success: boolean; message?: string; data: T };

export type ProductInput = {
  name: string;
  description?: string | null;
  price: number;
  category_id: number | null;
  image_url?: string | null;
  active: boolean | number;
  product_type: "comum" | "pizza" | string;
  display_order?: number | null;
  is_vegetarian?: boolean | number;
  is_vegan?: boolean | number;
  is_gluten_free?: boolean | number;
  is_spicy?: boolean | number;
  preparation_time?: number | null;
  pizza_sizes?: number[];
  pizza_flavors?: number[];
  pizza_borders?: number[];
  pizza_extras?: number[];
};

export async function getProductById(id: number): Promise<ApiResponse<any>> {
  const res = await httpClient.get(`/products/${id}` as string);
  return res as ApiResponse<any>;
}

export async function createProduct(payload: ProductInput): Promise<ApiResponse<any>> {
  const res = await httpClient.post(`/products`, payload as any);
  return res as ApiResponse<any>;
}

export async function updateProduct(id: number, payload: ProductInput): Promise<ApiResponse<any>> {
  const res = await httpClient.put(`/products/${id}`, payload as any);
  return res as ApiResponse<any>;
}