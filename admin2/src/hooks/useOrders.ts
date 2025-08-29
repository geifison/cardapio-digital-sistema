import { useCallback, useEffect, useMemo, useState } from "react";
import { httpClient } from "@/lib/http";
import { normalizeText } from "@/lib/utils";
import { getAdminSocket } from "@/lib/socket";

export type OrderItem = {
  id?: number;
  order_id?: number;
  product_id?: number | null;
  product_name: string;
  product_price: number;
  quantity: number;
  subtotal: number;
  notes?: string | null;
};

export type OrderStatus =
  | "novo"
  | "aceito"
  | "producao"
  | "entrega"
  | "finalizado"
  | "cancelado";

export type PaymentMethod = "dinheiro" | "pix" | "cartao" | string;

export type Order = {
  id: number;
  order_number: string;
  status: OrderStatus;
  customer_name: string;
  customer_phone: string;
  customer_address?: string | null;
  customer_neighborhood?: string | null;
  customer_reference?: string | null;
  order_type?: "delivery" | "retirada" | string | null;
  payment_method?: PaymentMethod | null;
  payment_value?: number | null;
  payment_status?: number | null;
  total_amount: number;
  delivery_fee?: number | null;
  change_amount?: number | null;
  notes?: string | null;
  estimated_delivery_time?: number | null;
  created_at?: string;
  updated_at?: string;
  accepted_at?: string | null;
  production_started_at?: string | null;
  delivery_started_at?: string | null;
  completed_at?: string | null;
  items: OrderItem[];
};

export type ApiResponse<T> = { success: boolean; message?: string; data: T };

export type OrderFilters = {
  search?: string;
  status?: OrderStatus | "todos";
  date?: string; // YYYY-MM-DD (um único dia)
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  // novos filtros client-side (opcionais)
  allowedStatuses?: OrderStatus[]; // quando definido, filtra por estes status no client-side
};

export type UseOrdersOptions = {
  initialFilters?: OrderFilters;
  debounceMs?: number;
  autoFetch?: boolean;
};

const nextStatusMap: Record<OrderStatus, OrderStatus | null> = {
  novo: "aceito",
  aceito: "producao",
  producao: "entrega",
  entrega: "finalizado",
  finalizado: null,
  cancelado: null,
};

export function useOrders(options: UseOrdersOptions = {}) {
  const { initialFilters = {}, debounceMs = 300, autoFetch = true } = options;

  const [filters, setFilters] = useState<OrderFilters>(initialFilters);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search || "");

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (filters.search === undefined) return;
    const t = setTimeout(() => setDebouncedSearch(filters.search?.trim() || ""), debounceMs);
    return () => clearTimeout(t);
  }, [filters.search, debounceMs]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = "/orders";

      // A API aceita OU status OU date (dia único). Preferimos status quando presente e diferente de "todos".
      const params: string[] = [];
      if (filters.status && filters.status !== "todos") {
        // Tratamento especial: quando status === 'finalizado', buscamos sem filtrar no servidor
        // para permitir incluir também pedidos 'cancelado' no client-side conforme regra de UI.
        if (filters.status !== "finalizado") {
          params.push(`status=${encodeURIComponent(filters.status)}`);
        }
      } else if (filters.date) {
        params.push(`date=${encodeURIComponent(filters.date)}`);
      } else if (filters.dateFrom && filters.dateTo && filters.dateFrom === filters.dateTo) {
        // fallback: quando apenas período de 1 dia for informado e não houver status
        params.push(`date=${encodeURIComponent(filters.dateFrom)}`);
      }
      if (params.length) url += `?${params.join("&")}`;

      const res = await httpClient.get<ApiResponse<Order[]>>(url);
      if (!res.success) throw new Error(res.message || "Falha ao carregar pedidos");

      const data = (res.data || []) as Order[];
      setOrders(data);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar pedidos");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.date, filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    if (autoFetch) fetchOrders();
  }, [autoFetch, fetchOrders]);

  const filteredOrders = useMemo(() => {
    let base = orders.slice();

    // Quando o filtro for 'finalizado', devemos exibir também os pedidos cancelados
    if (filters.status === "finalizado") {
      base = base.filter((o) => o.status === "finalizado" || o.status === "cancelado");
    }

    // Se ambos (status e date) estiverem definidos (status != 'todos'), já filtramos no servidor por status.
    // Opcionalmente aplicar filtro de data no client-side se ambos informados.
    if (filters.status && filters.status !== "todos" && filters.date) {
      base = base.filter((o) => (o.created_at || "").startsWith(filters.date!));
    }

    // Filtro por período [dateFrom, dateTo] aplicado no client-side
    if (filters.dateFrom || filters.dateTo) {
      const from = filters.dateFrom || "0000-01-01";
      const to = filters.dateTo || "9999-12-31";
      base = base.filter((o) => {
        const d = (o.created_at || "").slice(0, 10); // YYYY-MM-DD
        if (!d) return false;
        return d >= from && d <= to;
      });
    }

    // Filtro de múltiplos status (somente client-side)
    if (filters.allowedStatuses && filters.allowedStatuses.length) {
      const setAllowed = new Set(filters.allowedStatuses);
      base = base.filter((o) => setAllowed.has(o.status));
    }

    // Busca por texto + suporte a palavra-chave de status ("finalizado"/"cancelado")
    const raw = normalizeText(debouncedSearch);
    if (raw) {
      const hasFin = raw.includes("finalizado");
      const hasCan = raw.includes("cancelado");
      let statusToken: OrderStatus | undefined;
      if (hasFin && !hasCan) statusToken = "finalizado";
      else if (hasCan && !hasFin) statusToken = "cancelado";

      // Aplica filtro por status quando presente na busca
      if (statusToken) {
        base = base.filter((o) => o.status === statusToken);
      }

      // Remove palavras de status da string de busca para não exigir correspondência em campos
      const q = raw
        .replace(/finalizado/g, " ")
        .replace(/cancelado/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (q) {
        base = base.filter((o) => {
          const fields = [
            o.order_number,
            o.customer_name,
            o.customer_phone,
            o.customer_address,
            o.customer_neighborhood,
            o.customer_reference,
          ]
            .filter(Boolean)
            .map((f) => normalizeText(String(f)));
          return fields.some((f) => f.includes(q));
        });
      }
    }

    // Ordena do mais recente para o mais antigo (quando possível)
    base.sort((a, b) => {
      const da = a.created_at ? Date.parse(a.created_at) : 0;
      const db = b.created_at ? Date.parse(b.created_at) : 0;
      return db - da;
    });

    return base;
  }, [orders, debouncedSearch, filters.status, filters.date, filters.dateFrom, filters.dateTo, filters.allowedStatuses]);

  const updateFilters = useCallback((next: Partial<OrderFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
    setDebouncedSearch(initialFilters.search || "");
  }, [initialFilters]);

  const refetch = useCallback(async () => {
    await fetchOrders();
  }, [fetchOrders]);

  // Socket.IO: atualiza em tempo real sem refetch; fallback para SSE
  useEffect(() => {
    if (!autoFetch) return;
    let unsub: (() => void) | null = null;
    try {
      const s = getAdminSocket();
      const onNew = () => {
         // em novo pedido, forçamos refetch para obter detalhes completos
         refetch();
       };
      const onUpdate = (ev: any) => {
        const { order_id, status } = ev || {};
        if (!order_id) return;
        // atualiza em memória quando possível
        setOrders((prev) => prev.map((o) => (o.id === Number(order_id) ? { ...o, status: status ?? o.status } : o)));
      };
      s.on('order:new', onNew);
      s.on('order:update', onUpdate);
      unsub = () => {
        try { s.off('order:new', onNew); s.off('order:update', onUpdate); } catch {}
      };
    } catch {
      // fallback SSE
      let es: EventSource | null = null;
      const onOrdersUpdated = (ev: MessageEvent) => {
        try {
          const data = JSON.parse((ev as any).data || "{}");
          const type = (data?.type as string) || '';
          if (type === "orders_updated") {
            refetch();
          }
        } catch {}
      };
      try {
        es = new EventSource("/api/events/stream");
        es.addEventListener("orders_updated", onOrdersUpdated as any);
      } catch {}
      unsub = () => {
        if (es) { try { es.removeEventListener("orders_updated", onOrdersUpdated as any); es.close(); } catch {} }
      };
    }
    return () => { if (unsub) unsub(); };
  }, [autoFetch, refetch]);

  const updateOrderStatus = useCallback(
    async (
      id: number,
      status: OrderStatus,
      extra?: Partial<Pick<Order, "estimated_delivery_time" | "payment_method" | "payment_value" | "notes">>
    ) => {
      try {
        const payload: any = { status, ...(extra || {}) };
        const res = await httpClient.put(`/orders/${id}`, payload);
        if (res.success) {
          // não faz refetch; atualizará via socket
          return { success: true, message: res.message } as { success: boolean; message?: string };
        }
        throw new Error(res.message || "Erro ao atualizar status do pedido");
      } catch (e: any) {
        return { success: false, message: e.message } as { success: boolean; message?: string };
      }
    },
    []
  );

  const cancelOrder = useCallback(async (id: number, reason?: string) => {
    try {
      let res: any;
      if (reason && reason.trim() !== "") {
        res = await httpClient.put(`/orders/${id}`, { status: "cancelado", cancellation_reason: reason.trim() } as any);
      } else {
        res = await httpClient.delete(`/orders/${id}`);
      }
      if (res.success) {
        // não refetch; sincroniza via socket
        return { success: true, message: res.message };
      }
      throw new Error(res.message || "Erro ao cancelar pedido");
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }, []);

  const updateOrder = useCallback(async (id: number, payload: Partial<Order>) => {
    try {
      const res = await httpClient.put(`/orders/${id}`, payload as any);
      if (res.success) {
        // não refetch imediato
        return { success: true, message: res.message };
      }
      throw new Error(res.message || "Erro ao atualizar pedido");
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }, []);

  const getOrderById = useCallback(async (id: number) => {
    return httpClient.get<ApiResponse<Order>>(`/orders/${id}`);
  }, []);

  return {
    // dados
    orders: filteredOrders,
    loading,
    error,
    filters,

    // controles
    updateFilters,
    resetFilters,
    refetch,

    // ações
    updateOrderStatus,
    cancelOrder,
    updateOrder,
    getOrderById,

    // utilitários
    nextStatusMap,
  } as const;
}