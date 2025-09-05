import { useState, useEffect } from "react";
import { httpClient } from "@/lib/http";

export type PizzaSize = {
  id: number;
  name: string;
  slices: number;
  max_flavors: number;
  price: number;
  description?: string;
  display_order?: number;
  active: boolean | number;
};

export type PizzaFlavor = {
  id: number;
  name: string;
  category?: string;
  category_value?: number;
  description?: string;
  ingredients?: string;
  image_url?: string;
  display_order?: number;
  active: boolean | number;
  is_vegan?: boolean | number;
  is_gluten_free?: boolean | number;
  is_spicy?: boolean | number;
};

export type PizzaBorder = {
  id: number;
  name: string;
  price?: number;
  description?: string;
  display_order?: number;
  active: boolean | number;
};

export type PizzaExtra = {
  id: number;
  name: string;
  category?: string;
  price: number;
  description?: string;
  display_order?: number;
  active: boolean | number;
};

type ApiResponse<T> = { success: boolean; data: T; message?: string };

export function usePizza() {
  const [sizes, setSizes] = useState<PizzaSize[]>([]);
  const [flavors, setFlavors] = useState<PizzaFlavor[]>([]);
  const [borders, setBorders] = useState<PizzaBorder[]>([]);
  const [extras, setExtras] = useState<PizzaExtra[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSizes = async () => {
    try {
      const response = await httpClient.get<ApiResponse<PizzaSize[]>>("/pizza/sizes?all=true");
      if (response.success) {
        setSizes(response.data || []);
      }
    } catch (err: any) {
      console.error("Erro ao carregar tamanhos:", err);
    }
  };

  const fetchFlavors = async () => {
    try {
      const response = await httpClient.get<ApiResponse<PizzaFlavor[]>>("/pizza/flavors?all=true");
      if (response.success) {
        setFlavors(response.data || []);
      }
    } catch (err: any) {
      console.error("Erro ao carregar sabores:", err);
    }
  };

  const fetchBorders = async () => {
    try {
      const response = await httpClient.get<ApiResponse<PizzaBorder[]>>("/pizza/borders?all=true");
      if (response.success) {
        setBorders(response.data || []);
      }
    } catch (err: any) {
      console.error("Erro ao carregar bordas:", err);
    }
  };

  const fetchExtras = async () => {
    try {
      const response = await httpClient.get<ApiResponse<PizzaExtra[]>>("/pizza/extras?all=true");
      if (response.success) {
        setExtras(response.data || []);
      }
    } catch (err: any) {
      console.error("Erro ao carregar adicionais:", err);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchSizes(),
        fetchFlavors(),
        fetchBorders(),
        fetchExtras()
      ]);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar dados de pizza");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  return {
    sizes,
    flavors,
    borders,
    extras,
    loading,
    error,
    refetch: fetchAll,
  };
}