import { createWithEqualityFn } from 'zustand/traditional';
import { useEffect } from 'react';
import { getAdminSocket } from '@/lib/socket';
import { httpClient } from '@/lib/http';
import type { Order, OrderStatus, ApiResponse } from '@/hooks/useOrders';
import { shallow } from 'zustand/shallow';

// Janela de debounce e grace period aprovadas
const DEBOUNCE_WINDOW_MS = 400;
const INTERACTION_GRACE_MS = 500;

interface OrdersState {
  orders: Order[];
  loading: boolean;
  error: string | null;
  socketConnected: boolean;
  // Flag de interação de UI (atualizada via eventos globais)
  uiInteracting: boolean;
  // Métricas básicas
  metrics: { eventsReceived: number; eventsFlushed: number; coalescedEvents: number; avgQueueTimeMs: number };
  
  // Actions
  fetchOrders: () => Promise<void>;
  updateOrderStatus: (id: number, status: OrderStatus, extra?: any) => Promise<{ success: boolean; message?: string }>;
  cancelOrder: (id: number, reason?: string) => Promise<{ success: boolean; message?: string }>;
  updateOrder: (id: number, payload: Partial<Order>) => Promise<{ success: boolean; message?: string }>;
  initializeSocket: () => void;
  disconnectSocket: () => void;
  addOrder: (order: Order) => void;
  updateOrderInStore: (orderId: number, updates: Partial<Order>) => void;
  removeOrder: (orderId: number) => void;
  // Marcação de interação do usuário
  markInteractionStart: () => void;
  markInteractionEnd: () => void;
}

export const useOrdersStore = createWithEqualityFn<OrdersState>((set, get) => {
  let socket: any = null;
  // Buffer e controle de flush
  let debounceTimer: any = null;
  let interactionHoldUntil = 0;
  type PendingEvt = { type: 'new' | 'update'; ts: number; order_id?: number; status?: OrderStatus };
  const queue: PendingEvt[] = [];
  const pendingUpdates = new Map<number, { status?: OrderStatus }>();
  let totalQueueTime = 0;

  const scheduleFlush = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => flushNow(), DEBOUNCE_WINDOW_MS);
  };

  const flushNow = async () => {
    const now = Date.now();
    // Segurar durante interação ou dentro do grace
    if (get().uiInteracting || now < interactionHoldUntil) {
      const waitMs = Math.max(10, (interactionHoldUntil || now) - now + 1);
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => flushNow(), waitMs);
      return;
    }
    if (queue.length === 0 && pendingUpdates.size === 0) return;

    // Métricas: tempo médio na fila
    let processed = 0;
    while (queue.length) {
      const evt = queue.shift()!;
      totalQueueTime += now - evt.ts;
      processed++;
    }

    const eventsReceived = get().metrics.eventsReceived;
    const prevFlushed = get().metrics.eventsFlushed;

    // Estratégia de coalescência: se houver "new" ou muitos updates, refetch
    const hasNew = true; // conservador: new events podem ter dados incompletos -> refetch
    const updatesCount = pendingUpdates.size;

    try {
      if (hasNew || updatesCount > 10) {
        await get().fetchOrders();
      } else if (updatesCount > 0) {
        // Aplicar updates diretos (status)
        pendingUpdates.forEach((upd, id) => {
          if (upd && (upd.status as any)) {
            get().updateOrderInStore(id, { status: upd.status as OrderStatus });
          }
        });
      }
    } finally {
      // limpar pendentes
      pendingUpdates.clear();
      // atualizar métrricas
      const flushedNow = prevFlushed + 1;
      const avgQueueTimeMs = processed > 0 ? Math.round(totalQueueTime / (eventsReceived || processed)) : get().metrics.avgQueueTimeMs;
      const coalescedEvents = Math.max(0, eventsReceived - flushedNow);
      set((state) => ({
        metrics: {
          eventsReceived: state.metrics.eventsReceived,
          eventsFlushed: flushedNow,
          coalescedEvents,
          avgQueueTimeMs,
        },
      }));
      if (typeof window !== 'undefined') {
        (window as any).__SOCKET_METRICS__ = get().metrics;
      }
    }
  };

  const enqueueNew = () => {
    set((s) => ({ metrics: { ...s.metrics, eventsReceived: s.metrics.eventsReceived + 1 } }));
    queue.push({ type: 'new', ts: Date.now() });
    scheduleFlush();
  };
  const enqueueUpdate = (order_id?: number, status?: OrderStatus) => {
    set((s) => ({ metrics: { ...s.metrics, eventsReceived: s.metrics.eventsReceived + 1 } }));
    queue.push({ type: 'update', ts: Date.now(), order_id, status });
    if (order_id) pendingUpdates.set(Number(order_id), { status });
    scheduleFlush();
  };
  
  return {
    orders: [],
    loading: false,
    error: null,
    socketConnected: false,
    uiInteracting: false,
    metrics: { eventsReceived: 0, eventsFlushed: 0, coalescedEvents: 0, avgQueueTimeMs: 0 },
    
    fetchOrders: async () => {
      console.log('🔄 Iniciando fetchOrders...');
      set({ loading: true, error: null });
      try {
        console.log('📡 Fazendo requisição para /orders');
        const response = await httpClient.get<ApiResponse<Order[]>>('/orders');
        console.log('📥 Resposta recebida:', response);
        if (response.success) {
          console.log('✅ Pedidos carregados:', response.data?.length || 0, 'pedidos');
          set({ orders: response.data || [], loading: false });
        } else {
          throw new Error(response.message || 'Erro ao carregar pedidos');
        }
      } catch (error: any) {
        console.error('❌ Erro ao carregar pedidos:', error);
        set({ error: error.message, loading: false, orders: [] });
      }
    },
    
    updateOrderStatus: async (id: number, status: OrderStatus, extra?: any) => {
      try {
        const payload = { status, ...(extra || {}) };
        const response = await httpClient.put(`/orders/${id}`, payload);
        if (response.success) {
          return { success: true, message: response.message };
        }
        throw new Error(response.message || 'Erro ao atualizar status do pedido');
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },
    
    cancelOrder: async (id: number, reason?: string) => {
      try {
        let response: any;
        if (reason && reason.trim() !== '') {
          response = await httpClient.put(`/orders/${id}`, { 
            status: 'cancelado', 
            cancellation_reason: reason.trim() 
          });
        } else {
          response = await httpClient.delete(`/orders/${id}`);
        }
        if (response.success) {
          return { success: true, message: response.message };
        }
        throw new Error(response.message || 'Erro ao cancelar pedido');
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },
    
    updateOrder: async (id: number, payload: Partial<Order>) => {
      try {
        const response = await httpClient.put(`/orders/${id}`, payload);
        if (response.success) {
          return { success: true, message: response.message };
        }
        throw new Error(response.message || 'Erro ao atualizar pedido');
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },
    
    initializeSocket: () => {
      console.log('🚨🚨🚨 INITIALIZE SOCKET CHAMADO 🚨🚨🚨');
      console.log('🔌 initializeSocket chamado');
      try {
        console.log('🔌 Chamando getAdminSocket...');
        const s = getAdminSocket();
        socket = s;
        console.log('🔌 Socket obtido:', socket ? 'existe' : 'null', socket?.connected);
        
        if (typeof window !== 'undefined' && socket) {
          (window as any).__ADMIN_SOCKET__ = socket;
        }
        
        if (socket) {
          console.log('🔌 Configurando listeners do socket...');
          
          // Listener para conexão
          socket.on('connect', () => {
            console.log('🔌 Socket conectado ao admin:', socket?.id);
            if (typeof window !== 'undefined') {
              (window as any).__SOCKET_CONNECTED__ = true;
              (window as any).__ADMIN_SOCKET__ = socket;
            }
            set({ socketConnected: true });
          });
          
          // Listener para desconexão
          socket.on('disconnect', () => {
            console.log('🔌 Socket desconectado do admin');
            if (typeof window !== 'undefined') {
              (window as any).__SOCKET_CONNECTED__ = false;
            }
            set({ socketConnected: false });
          });
          
          // Listener para novos pedidos (debounced)
          socket.on('order:new', (_event: any) => {
            enqueueNew();
          });
          
          // Listener para atualizações de status (coalescido)
          socket.on('order:update', (event: any) => {
            const { order_id, status } = event || {};
            enqueueUpdate(order_id ? Number(order_id) : undefined, status as OrderStatus | undefined);
          });
          
          // Se já estiver conectado, atualizar estado
          if (socket.connected) {
            console.log('🔌 Socket já estava conectado');
            if (typeof window !== 'undefined') {
              (window as any).__SOCKET_CONNECTED__ = true;
            }
            set({ socketConnected: true });
          }
        }
      } catch (error) {
        console.error('❌ Erro ao inicializar socket:', error);
        set({ socketConnected: false });
      }
    },
    
    disconnectSocket: () => {
      if (socket) {
        socket.off('order:new');
        socket.off('order:update');
        socket.off('connect');
        socket.off('disconnect');
        socket = null;
      }
      if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
      queue.length = 0;
      pendingUpdates.clear();
      if (typeof window !== 'undefined') {
        (window as any).__SOCKET_CONNECTED__ = false;
      }
      set({ socketConnected: false });
    },
    
    addOrder: (order: Order) => {
      set((state) => ({
        orders: [order, ...state.orders]
      }));
    },
    
    updateOrderInStore: (orderId: number, updates: Partial<Order>) => {
      set((state) => ({
        orders: state.orders.map(order => 
          order.id === orderId ? { ...order, ...updates } : order
        )
      }));
    },
    
    removeOrder: (orderId: number) => {
      set((state) => ({
        orders: state.orders.filter(order => order.id !== orderId)
      }));
    },

    markInteractionStart: () => {
      interactionHoldUntil = Date.now() + INTERACTION_GRACE_MS; // inicia janela de grace
      set({ uiInteracting: true });
    },
    markInteractionEnd: () => {
      interactionHoldUntil = Date.now() + INTERACTION_GRACE_MS; // segura mais um pouco
      set({ uiInteracting: false });
      // tentar dar flush assim que possível
      scheduleFlush();
    },
  };
}, shallow);

// Expor store e status no window para testes/debug
if (typeof window !== 'undefined') {
  try {
    (window as any).__ZUSTAND_STORE__ = (window as any).__ZUSTAND_STORE__ || {};
    (window as any).__ZUSTAND_STORE__.ordersStore = useOrdersStore.getState();
    (window as any).__SOCKET_CONNECTED__ = useOrdersStore.getState().socketConnected;
    (window as any).__SOCKET_METRICS__ = useOrdersStore.getState().metrics;
    useOrdersStore.subscribe((state) => {
      (window as any).__ZUSTAND_STORE__.ordersStore = state;
      (window as any).__SOCKET_CONNECTED__ = state.socketConnected;
      (window as any).__SOCKET_METRICS__ = state.metrics;
    });
  } catch {}
}

// Removido: hook useOrdersRealtime (subscrição do store completo) para evitar re-renders desnecessários.
// Utilize useOrdersInit para side-effects e useOrdersData/useOrdersActions para seleção estável.

// Novo hook de inicialização sem assinatura para reduzir re-renderizações
export const useOrdersInit = () => {
  useEffect(() => {
    const st = useOrdersStore.getState();
    st.initializeSocket();
    st.fetchOrders();

    const onPointerDown = () => useOrdersStore.getState().markInteractionStart();
    const onPointerUp = () => useOrdersStore.getState().markInteractionEnd();

    window.addEventListener('pointerdown', onPointerDown as any, { passive: true } as any);
    window.addEventListener('pointerup', onPointerUp as any, { passive: true } as any);

    return () => {
      useOrdersStore.getState().disconnectSocket();
      window.removeEventListener('pointerdown', onPointerDown as any);
      window.removeEventListener('pointerup', onPointerUp as any);
    };
  }, []);
};

// Seletores finos para reduzir re-renderizações em consumidores
export const useOrdersData = () =>
  useOrdersStore((s) => ({ orders: s.orders, loading: s.loading, error: s.error }));

export const useOrdersActions = () =>
  useOrdersStore(
    (s) => ({
      fetchOrders: s.fetchOrders,
      updateOrderStatus: s.updateOrderStatus,
      cancelOrder: s.cancelOrder,
      updateOrder: s.updateOrder,
    })
  );

// Exporta apenas as funções necessárias para outros componentes
export const ordersActions = {
  fetchOrders: () => useOrdersStore.getState().fetchOrders(),
  updateOrderStatus: (id: number, status: OrderStatus, extra?: any) => 
    useOrdersStore.getState().updateOrderStatus(id, status, extra),
  cancelOrder: (id: number, reason?: string) => 
    useOrdersStore.getState().cancelOrder(id, reason),
  updateOrder: (id: number, payload: Partial<Order>) => 
    useOrdersStore.getState().updateOrder(id, payload),
  addOrder: (order: Order) => useOrdersStore.getState().addOrder(order),
  updateOrderInStore: (orderId: number, updates: Partial<Order>) => 
    useOrdersStore.getState().updateOrderInStore(orderId, updates),
  markInteractionStart: () => useOrdersStore.getState().markInteractionStart(),
  markInteractionEnd: () => useOrdersStore.getState().markInteractionEnd(),
};